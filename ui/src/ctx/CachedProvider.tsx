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

  return <CachedCtx.Provider value={ctxValue} {...props} />;
}
