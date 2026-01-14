import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useDelay<const T extends readonly number[]>(timeNodes: T) {
  const [delayStage, setDelayStage] = useState<Set<T[number]>>(new Set());
  const mountTime = useRef(performance.now());
  const stableTimeNodes = useStableArray(timeNodes);

  const delay = useCallback(
    (time: T[number]) => {
      return delayStage.has(time);
    },
    [delayStage]
  );

  useLayoutEffect(() => {
    const now = performance.now();
    const elapsed = now - mountTime.current;
    const sorted = [...stableTimeNodes].sort((a, b) => a - b);
    const timers: number[] = [];

    for (const time of sorted) {
      const delay = Math.max(0, time - elapsed);
      timers.push(
        window.setTimeout(() => {
          setDelayStage((prev) => new Set(prev).add(time));
        }, delay)
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [stableTimeNodes]);

  return delay;
}

function useStableArray<T extends readonly number[]>(arr: T): T {
  const ref = useRef<T>(arr);

  if (arr.length !== ref.current.length || arr.some((v, i) => v !== ref.current[i])) {
    ref.current = arr;
  }

  return ref.current;
}
