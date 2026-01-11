import { RefObject, useEffect } from "react";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";

export function useListenResize(dom: RefObject<Nullable<HTMLElement>>) {
  const update = useUpdate();

  useEffect(() => {
    const element = dom.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });

    ro.observe(element);
    // 首帧也触发一次，确保拿到稳定布局尺寸
    raf = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [dom, update]);

  return update.count;
}
