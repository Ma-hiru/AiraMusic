import { startTransition, useCallback, useLayoutEffect, useRef, useState } from "react";
import { useStableArray } from "@mahiru/ui/public/hooks/useStableArray";

export function useDelay<const T extends readonly number[]>(timeNodes: T) {
  const [delayStage, setDelayStage] = useState<Set<T[number]>>(() => new Set());
  const mountTime = useRef(performance.now());
  const stableTimeNodes = useStableArray(timeNodes);

  const delay = useCallback((time: T[number]) => delayStage.has(time), [delayStage]);

  useLayoutEffect(() => {
    const now = performance.now();
    const elapsed = now - mountTime.current;
    const sorted = [...stableTimeNodes].sort((a, b) => a - b);
    const timers: number[] = [];
    const update = (time: number, delay: number) => {
      const timer = window.setTimeout(() => {
        startTransition(() => {
          setDelayStage((prev) => new Set(prev).add(time));
        });
      }, delay);
      timers.push(timer);
    };

    for (const time of sorted) {
      const delay = Math.max(0, time - elapsed);
      update(time, delay);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [stableTimeNodes]);

  return delay;
}
