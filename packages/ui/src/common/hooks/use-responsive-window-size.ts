import { useRef, type RefObject, useLayoutEffect } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useListenable } from "@/common/hooks/use-listenable";

export function useResponsiveWindowSize(containerRef: RefObject<Nullable<HTMLElement>>) {
  const contentSizeRef = useRef<Nullable<{ width: number; height: number }>>(null);
  const currentWindow = useListenable(RendererWindow.current);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const updateWindowBounds = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const width = Math.ceil(container.offsetWidth || window.innerWidth);
        const height = Math.ceil(container.offsetHeight || window.innerHeight);
        const currentSize = contentSizeRef.current;
        if (currentSize?.width === width && currentSize.height === height) return;

        contentSizeRef.current = { height, width };
        const deltaX = window.innerWidth - width;
        const deltaY = window.innerHeight - height;

        currentWindow.resize({ width, height });
        currentWindow.move({
          x: window.screenX + deltaX,
          y: window.screenY + deltaY
        });
      });
    };

    const observer = new ResizeObserver(updateWindowBounds);
    observer.observe(container);
    updateWindowBounds();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [containerRef, currentWindow]);
}
