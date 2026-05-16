import { RefObject, useLayoutEffect } from "react";

export function useScrollAutoHide(
  containerRef: RefObject<Nullable<HTMLElement>>,
  delay = 800,
  disabled = false
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (disabled) {
      container.classList.add("scrollbar-hide");
      return () => container.classList.remove("scrollbar-hide");
    } else {
      container.classList.add("scrollbar");

      let timer: number;
      const onScroll = () => container.classList.add("scrollbar-show");
      const onScrollEnd = () => {
        timer && window.clearTimeout(timer);
        timer = window.setTimeout(() => container.classList.remove("scrollbar-show"), delay);
      };
      container.addEventListener("scroll", onScroll, { passive: true });
      container.addEventListener("scrollend", onScrollEnd, { passive: true });

      return () => {
        timer && window.clearTimeout(timer);
        container.removeEventListener("scroll", onScroll);
        container.removeEventListener("scrollend", onScrollEnd);
        container.classList.remove("scrollbar");
        container.classList.remove("scrollbar-show");
      };
    }
  }, [containerRef, delay, disabled]);
}
