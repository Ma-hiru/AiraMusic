import { useCallback, useEffect, useRef, useState } from "react";

export function useDelay() {
  const [, forceUpdate] = useState(0);
  // 页面级时间起点
  const timeOrigin = performance.timeOrigin;
  // 目标执行时间（绝对时间）
  const targetTimeRef = useRef<number | null>(null);
  // 是否已触发
  const firedRef = useRef(false);
  const ready = targetTimeRef.current == null ? true : performance.now() >= targetTimeRef.current;
  const requestDelay = useCallback((delayMs: number) => {
    const target = performance.now() + delayMs;
    // 取最早的那个时间
    if (targetTimeRef.current == null || target < targetTimeRef.current) {
      targetTimeRef.current = target;
      firedRef.current = false;
    }
    // 强制一次检查
    forceUpdate((n) => n + 1);
  }, []);
  useEffect(() => {
    if (targetTimeRef.current == null) return;
    if (firedRef.current) return;

    let rafId: number;

    const check = () => {
      if (performance.now() >= targetTimeRef.current!) {
        firedRef.current = true;
        forceUpdate((n) => n + 1);
      } else {
        rafId = requestAnimationFrame(check);
      }
    };

    rafId = requestAnimationFrame(check);

    return () => cancelAnimationFrame(rafId);
  }, [ready]);

  return {
    ready,
    requestDelay
  };
}
