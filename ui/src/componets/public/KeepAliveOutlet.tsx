import {
  useImperativeHandle,
  forwardRef,
  ForwardRefRenderFunction,
  ReactNode,
  useRef,
  useCallback
} from "react";
import { useOutlet, useLocation } from "react-router-dom";

export type KeepAliveOutletRef = {
  clearCache: (pathname: string) => void;
};

const KeepAliveOutlet: ForwardRefRenderFunction<KeepAliveOutletRef, object> = (_, ref) => {
  const outlet = useOutlet();
  const location = useLocation();
  const cacheRef = useRef<Record<string, ReactNode>>({});

  const clearCache = useCallback((pathname: string) => {
    cacheRef.current[pathname] && (cacheRef.current[pathname] = undefined);
  }, []);
  useImperativeHandle(ref, () => ({
    clearCache
  }));

  if (location.pathname && !cacheRef.current[location.pathname]) {
    cacheRef.current[location.pathname] = outlet;
  }

  return cacheRef.current[location.pathname];
};
export default forwardRef(KeepAliveOutlet);
