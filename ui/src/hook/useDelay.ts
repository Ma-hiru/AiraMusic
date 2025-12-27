import { startTransition, useEffect, useRef, useState } from "react";

export function useDelay<const T extends readonly number[]>(timeNode: T) {
  const mountTime = useRef(performance.now());
  const [delayStage, setDelayStage] = useState<Set<T[number]>>(new Set());
  const delayRef = useRef(delayStage);
  delayRef.current = delayStage;

  useEffect(() => {
    const now = performance.now();
    const elapsed = now - mountTime.current;
    const sorted = [...timeNode].sort((a, b) => a - b);
    const timers: number[] = [];

    for (const time of sorted) {
      timers.push(
        window.setTimeout(() => {
          startTransition(() => {
            const newSet = new Set(delayRef.current);
            newSet.add(time);
            setDelayStage(newSet);
          });
        }, time - elapsed)
      );
    }

    return () => {
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line
  }, []);

  return delayStage;
}
