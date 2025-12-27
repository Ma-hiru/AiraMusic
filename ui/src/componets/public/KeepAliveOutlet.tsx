import {
  forwardRef,
  ForwardRefRenderFunction,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { useLocation, useOutlet } from "react-router-dom";
import { KeepAliveBuildKey, KeepAliveCtx } from "@mahiru/ui/ctx/KeepAliveCtx";

export type KeepAliveOutletRef = {
  clearCache: (pathname: string) => void;
};

interface KeepAliveOutletProps {
  cache?: boolean;
  maxCache?: number;
}

const KeepAliveOutlet: ForwardRefRenderFunction<KeepAliveOutletRef, KeepAliveOutletProps> = (
  { cache = true, maxCache = 10 },
  ref
) => {
  const outlet = useOutlet();
  const location = useLocation();
  const forceUpdate = useUpdate();
  const cacheRef = useRef<Map<string, ReactNode>>(new Map());
  const [activeKey, setActiveKey] = useState<string>();

  const currentKey = cache ? KeepAliveBuildKey(location.pathname, location.search) : undefined;

  const clearCache = useCallback(
    (pathname: string) => {
      let removed = false;
      cacheRef.current.forEach((_, key) => {
        if (key === pathname || key.startsWith(`${pathname}?`)) {
          cacheRef.current.delete(key);
          removed = true;
        }
      });
      removed && forceUpdate();
    },
    [forceUpdate]
  );
  useImperativeHandle(ref, () => ({
    clearCache
  }));

  useEffect(() => {
    setActiveKey(currentKey);
  }, [currentKey]);

  if (!cache) return outlet;
  if (currentKey) {
    cacheRef.current.set(currentKey, outlet);
    // 超出上限时移除最旧的一个缓存
    if (cacheRef.current.size > maxCache) {
      const oldestKey = cacheRef.current.keys().next().value as string | undefined;
      if (oldestKey && oldestKey !== currentKey) {
        cacheRef.current.delete(oldestKey);
      } else if (oldestKey) {
        // 如果最旧的是当前 key，删除下一个
        const iterator = cacheRef.current.keys();
        iterator.next();
        const nextKey = iterator.next().value as string | undefined;
        if (nextKey) cacheRef.current.delete(nextKey);
      }
    }
  }

  const entries = Array.from(cacheRef.current.entries()).filter(([, node]) => Boolean(node));
  if (entries.length === 0) return null;

  return (
    <KeepAliveCtx.Provider value={{ activeKey }}>
      {entries.map(([key, element]) => (
        <div
          key={key}
          style={{ display: key === currentKey ? "block" : "none", width: "100%", height: "100%" }}
          aria-hidden={key === currentKey ? undefined : "true"}>
          {element}
        </div>
      ))}
    </KeepAliveCtx.Provider>
  );
};
export default forwardRef(KeepAliveOutlet);
