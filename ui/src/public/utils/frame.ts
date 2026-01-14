export function nextFrame<T extends NormalFunc<[time: DOMHighResTimeStamp]>>(cb?: T) {
  return new Promise<void>((resolve) => {
    requestAnimationFrame((time) => {
      resolve();
      cb?.(time);
    });
  });
}

export function nextIdle(timeout: number, cb?: NormalFunc) {
  return new Promise<void>((resolve) => {
    requestIdleCallback(
      () => {
        resolve();
        cb?.();
      },
      { timeout }
    );
  });
}
