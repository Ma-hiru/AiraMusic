import { useCallback, useRef, RefObject } from "react";
import { debounce } from "lodash-es";

export function useScrollAutoHide(containerRef: RefObject<Nullable<HTMLElement>>) {
  const scrollTimer = useRef<Nullable<number>>(null);
  const onScroll = debounce(
    () => {
      const container = containerRef.current;
      if (container) {
        scrollTimer.current && window.clearTimeout(scrollTimer.current);
        container.classList.add("scrollbar-show");
      }
    },
    100,
    {
      leading: true
    }
  );
  const onScrollEnd = useCallback(() => {
    scrollTimer.current = window.setTimeout(() => {
      const container = containerRef.current;
      if (container) {
        container.classList.remove("scrollbar-show");
      }
    }, 300);
  }, [containerRef]);
  useCallback(() => {
    return () => {
      if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    };
  }, []);

  return {
    onScroll,
    onScrollEnd
  };
}
