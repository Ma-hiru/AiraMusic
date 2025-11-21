import { ReactNode, useEffect, useMemo, useRef } from "react";
import { CachedCtx } from "./CachedCtx";

export default function CachedProvider(props: { children: ReactNode }) {
  const cachedMap = useRef(new Map<string, string>()).current;
  const ctxValue = useMemo(() => cachedMap, [cachedMap]);
  useEffect(() => {
    return () => {
      // 组件卸载时，释放所有创建的 object URL
      cachedMap?.forEach((objectURL) => {
        URL.revokeObjectURL(objectURL);
      });
      cachedMap?.clear();
    };
  }, [cachedMap]);
  useEffect(() => {
    // 控制缓存数量，避免内存占用过高
    const interval = setInterval(() => {
      limitSize(cachedMap);
    }, 5000);
    return () => {
      clearInterval(interval);
    };
  }, [cachedMap]);

  return <CachedCtx.Provider value={ctxValue} {...props} />;
}

// 控制缓存数量，避免内存占用过高
function limitSize(cachedMap: Map<string, string>, size: number = 25) {
  console.log("CachedCtx", "current cache size:", cachedMap.size, cachedMap.size > size);
  if (cachedMap.size > size) {
    console.log("CachedCtx", "limit cache size, current size:", cachedMap.size);
    const keys = Array.from(cachedMap.keys());
    const removeCount = Math.ceil(cachedMap.size - size);
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
