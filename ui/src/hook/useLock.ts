import { useMemo, useRef } from "react";

export function useLock() {
  const lock = useRef(false);

  const acquireLock = useRef(() => {
    if (lock.current) return false;
    lock.current = true;
    return true;
  }).current;

  const releaseLock = useRef(() => {
    lock.current = false;
  }).current;

  const runWithLock = useRef((task: () => void, releaseAfterTask = false) => {
    if (!acquireLock()) return false;
    let didThrow = true;
    try {
      task();
      didThrow = false;
    } finally {
      if (didThrow || releaseAfterTask) {
        releaseLock();
      }
    }
    return true;
  }).current;

  return useMemo(
    () => ({
      lock: acquireLock,
      unlock: releaseLock,
      run: runWithLock
    }),
    [acquireLock, releaseLock, runWithLock]
  );
}
