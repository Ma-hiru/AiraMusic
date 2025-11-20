import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";

export const CachedCtx = createContext(new Map<string, string>());

export function useCache(url?: string, defaultURL: string | null = null) {
  const [cachedURL, setCachedURL] = useState<Nullable<string>>(defaultURL);
  const cachedMap = useContext(CachedCtx);
  const cached = useRef(false);
  const oldObjStack = useRef<string[]>([]).current;
  useLayoutEffect(() => {
    if (url) {
      if (cachedMap.has(url)) {
        setCachedURL(cachedMap.get(url)!);
        cached.current = true;
      } else {
        setCachedURL(wrapCacheUrl(url));
        cached.current = false;
      }
    }
  }, [cachedMap, url]);
  // 抽离出更新函数，方便控制何时获取缓存，避免多个请求重复下载，可以充分利用 304 缓存
  const update = useCallback(async () => {
    if (url) {
      try {
        const blob = await fetch(wrapCacheUrl(url)).then((res) => res.blob());
        const objectURL = URL.createObjectURL(blob);
        if (cachedMap.has(url)) {
          const oldObjectURL = cachedMap.get(url)!;
          oldObjStack.push(oldObjectURL);
        }
        cachedMap.set(url, objectURL);
        setCachedURL(objectURL);
        cached.current = true;
      } catch {
        // do nothing
      }
    }
  }, [cachedMap, url, oldObjStack]);
  const init = useCallback(() => {
    if (!cached.current) update();
  }, [update]);
  const fail = useCallback(() => {
    // 加载失败则释放缓存，退回到原始 URL
    if (cachedURL && cachedURL.startsWith("blob:") && url) {
      const objectURL = cachedMap.get(url);
      objectURL && oldObjStack.push(objectURL);
      cachedMap.delete(url);
      setCachedURL(wrapCacheUrl(url));
    }
  }, [cachedMap, url, cachedURL, oldObjStack]);
  useEffect(() => {
    return () => {
      // 组件卸载时释放不再使用的 object URL
      while (oldObjStack.length > 0) {
        const objectURL = oldObjStack.pop()!;
        URL.revokeObjectURL(objectURL);
      }
      // 控制缓存数量
      limitSize(cachedMap);
    };
  }, [cachedMap, oldObjStack]);

  return {
    cached: cached.current,
    cachedURL,
    update,
    init,
    fail
  };
}

// 控制缓存数量，避免内存占用过高
function limitSize(cachedMap: Map<string, string>, size: number = 250) {
  if (cachedMap.size > size) {
    const keys = Array.from(cachedMap.keys());
    const removeCount = Math.ceil(cachedMap.size / 5);
    for (let i = 0; i < removeCount; i++) {
      const key = keys[i]!;
      const objectURL = cachedMap.get(key);
      if (objectURL) {
        URL.revokeObjectURL(objectURL);
      }
      cachedMap.delete(key);
    }
  }
}
