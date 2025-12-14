import {
  forwardRef,
  ForwardRefRenderFunction,
  ReactNode,
  useCallback,
  useImperativeHandle,
  useRef
} from "react";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { useLocation, useOutlet } from "react-router-dom";

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
  const cacheRef = useRef<Map<string, ReactNode>>(new Map());
  const forceUpdate = useUpdate();

  const buildKey = useCallback((pathname: string, search?: string) => {
    // playlist/:id 不分配独立缓存，统一使用 /playlist 作为 key
    if (pathname.startsWith("/playlist/")) return "/playlist";
    return `${pathname}${search ?? ""}`;
  }, []);
  const currentKey = cache ? buildKey(location.pathname, location.search) : undefined;

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

  if (!cache) {
    return outlet;
  }

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
  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map(([key, element]) => (
        <div
          key={key}
          style={{ display: key === currentKey ? "block" : "none", width: "100%", height: "100%" }}
          aria-hidden={key === currentKey ? undefined : "true"}>
          {element}
        </div>
      ))}
    </>
  );
};
export default forwardRef(KeepAliveOutlet);
