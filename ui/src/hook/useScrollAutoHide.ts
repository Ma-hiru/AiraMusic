import { useCallback, useEffect, useRef, RefObject } from "react";

const SCROLLBAR_HIDE_DELAY = 800;

export function useScrollAutoHide(containerRef: RefObject<Nullable<HTMLElement>>) {
  const hideTimerRef = useRef<number | null>(null);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // 立即显示滚动条
    container.classList.add("scrollbar-show");
    // 清除之前的定时器
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    // 设置新的隐藏定时器
    hideTimerRef.current = window.setTimeout(() => {
      container.classList.remove("scrollbar-show");
      hideTimerRef.current = null;
    }, SCROLLBAR_HIDE_DELAY);
  }, [containerRef]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  return {
    onScroll
  };
}
