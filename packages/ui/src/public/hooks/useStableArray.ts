import { useRef } from "react";

export function useStableArray<T extends readonly any[]>(arr: T): T {
  const ref = useRef<T>(arr);

  if (arr.length !== ref.current.length || arr.some((v, i) => v !== ref.current[i])) {
    ref.current = arr;
  }

  return ref.current;
}
