import { RefObject, useCallback, useEffect, useRef } from "react";

const SCROLLBAR_HIDE_DELAY = 800;

export function useScrollAutoHide(
  containerRef: RefObject<Nullable<HTMLElement>>,
  disabled = false
) {
  const hideTimerRef = useRef<number | null>(null);

  const onScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container || disabled) return;
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
  }, [containerRef, disabled]);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      if (disabled) {
        // 如果禁用滚定条，立马隐藏
        container.classList.remove("scrollbar-show");
        container.classList.add("scrollbar-hide");
      } else {
        container.classList.remove("scrollbar-hide");
      }
    }
  }, [containerRef, disabled]);

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
