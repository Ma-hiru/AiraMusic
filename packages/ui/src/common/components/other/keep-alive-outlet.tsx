import { useOutlet, useLocation } from "react-router-dom";
import {
  type FC,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
  useImperativeHandle
} from "react";
import { useUpdate } from "@/common/hooks/use-update";

export type KeepAliveOutletRef = {
  clearCache: (pathname: string) => void;
};

interface KeepAliveOutletProps {
  ref?: Ref<KeepAliveOutletRef>;
  cache?: boolean;
  maxCache?: number;
}

const KeepAliveOutlet: FC<KeepAliveOutletProps> = ({ ref, cache = true, maxCache = 10 }) => {
  const outlet = useOutlet();
  const location = useLocation();
  const forceUpdate = useUpdate();
  const cacheMap = useMemo(() => new Map<string, ReactNode>(), []);
  const [activeKey, setActiveKey] = useState<string>();

  useEffect(() => {
    setActiveKey(cache ? location.pathname : undefined);
  }, [cache, location.pathname]);

  const clearCache = useCallback(
    (pathname: string) => {
      let removed = false;
      cacheMap.forEach((_, key) => {
        if (key === pathname || key.startsWith(`${pathname}?`)) {
          cacheMap.delete(key);
          removed = true;
        }
      });
      removed && forceUpdate();
    },
    [cacheMap, forceUpdate]
  );

  useImperativeHandle(ref, () => ({ clearCache }), [clearCache]);

  if (!cache) return outlet;
  if (activeKey && !cacheMap.has(activeKey)) cacheMap.set(activeKey, outlet);
  if (cacheMap.size === 0) return null;
  if (cacheMap.size > maxCache) {
    const oldestKey = cacheMap.keys().next().value as string | undefined;
    if (oldestKey && oldestKey !== activeKey) {
      cacheMap.delete(oldestKey);
    } else if (oldestKey) {
      // 如果最旧的是当前 key，删除下一个
      const iterator = cacheMap.keys();
      iterator.next();
      const nextKey = iterator.next().value as string | undefined;
      if (nextKey) cacheMap.delete(nextKey);
    }
  }

  return (
    <>
      {Array.from(cacheMap.entries()).map(([key, element]) => (
        <div
          key={key}
          style={{ display: key === activeKey ? "block" : "none", width: "100%", height: "100%" }}
          aria-hidden={key === activeKey ? undefined : "true"}>
          {element}
        </div>
      ))}
    </>
  );
};

export default KeepAliveOutlet;
