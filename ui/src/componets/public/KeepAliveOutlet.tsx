import {
  useImperativeHandle,
  forwardRef,
  ForwardRefRenderFunction,
  ReactNode,
  useRef,
  useCallback
} from "react";
import { useUpdate } from "@mahiru/ui/hook/useUpdate";
import { useOutlet, useLocation } from "react-router-dom";

export type KeepAliveOutletRef = {
  clearCache: (pathname: string) => void;
};

interface KeepAliveOutletProps {
  cache?: boolean;
}

const KeepAliveOutlet: ForwardRefRenderFunction<KeepAliveOutletRef, KeepAliveOutletProps> = (
  { cache = true },
  ref
) => {
  const outlet = useOutlet();
  const location = useLocation();
  const cacheRef = useRef<Record<string, ReactNode>>({});
  const forceUpdate = useUpdate();

  const buildKey = useCallback(
    (pathname: string, search?: string) => `${pathname}${search ?? ""}`,
    []
  );
  const currentKey = cache ? buildKey(location.pathname, location.search) : undefined;

  const clearCache = useCallback(
    (pathname: string) => {
      const keys = Object.keys(cacheRef.current);
      let removed = false;
      keys.forEach((key) => {
        if (key === pathname || key.startsWith(`${pathname}?`)) {
          delete cacheRef.current[key];
          removed = true;
        }
      });
      if (removed) {
        forceUpdate();
      }
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
    cacheRef.current[currentKey] = outlet;
  }
  const entries = Object.entries(cacheRef.current).filter(([, node]) => Boolean(node));
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
