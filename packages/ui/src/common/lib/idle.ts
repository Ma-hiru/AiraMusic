export type Task<R> = () => Generator<unknown, R, unknown>;

export interface RendererIdleOptions {
  /** 每次空闲回调的最长等待时间，默认 1000ms */
  timeout?: number;
  /** 每个时间片的最大执行时长，默认 8ms */
  maxSliceMs?: number;
  /** 每个时间片最多执行多少次 next()，默认 1000 */
  maxStepsPerSlice?: number;
  /** 浏览器剩余空闲时间阈值，默认 1ms */
  minRemainingMs?: number;
  /** 用于主动取消任务 */
  signal?: AbortSignal;
}

export type AsyncTask<R> = () => AsyncGenerator<unknown, R, unknown>;

export type RendererIdleAsyncOptions = Pick<
  RendererIdleOptions,
  "signal" | "timeout" | "minRemainingMs"
>;

export class RendererIdle {
  static run<R>(
    task: Task<R>,
    {
      signal,
      maxSliceMs = 8,
      timeout = 1000,
      minRemainingMs = 1,
      maxStepsPerSlice = 1000
    }: RendererIdleOptions = {}
  ): Promise<R> {
    if (
      !Number.isFinite(timeout) ||
      timeout <= 0 ||
      !Number.isFinite(maxSliceMs) ||
      maxSliceMs <= 0 ||
      !Number.isSafeInteger(maxStepsPerSlice) ||
      maxStepsPerSlice <= 0 ||
      !Number.isFinite(minRemainingMs) ||
      minRemainingMs < 0
    ) {
      return Promise.reject(new RangeError("Invalid RendererIdle options"));
    }

    const abortReason = () => signal?.reason ?? new DOMException("Task aborted", "AbortError");

    if (signal?.aborted) return Promise.reject(abortReason());
    return new Promise<R>((resolve, reject) => {
      let iterator: Generator<unknown, R, unknown>;

      try {
        iterator = task();
      } catch (error) {
        reject(error);
        return;
      }

      let idleId: number | undefined;
      let settled = false;
      let running = false;

      const cleanup = () => {
        if (idleId !== undefined) {
          window.cancelIdleCallback(idleId);
          idleId = undefined;
        }
        signal?.removeEventListener("abort", onAbort);
      };
      const complete = (value: R) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const abort = () => {
        if (settled) return;
        settled = true;
        cleanup();
        try {
          // 触发 Generator 的 finally
          iterator.return(undefined as R);
        } catch {
          // 保留原始取消原因
        }
        reject(abortReason());
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };

      const onAbort = () => {
        // 不允许在 iterator.next() 执行期间调用 return()
        // 当前时间片会在 next() 返回后处理取消
        if (!running) abort();
      };

      const step = (deadline: IdleDeadline): void => {
        idleId = undefined;
        if (settled) return;
        running = true;

        const startedAt = performance.now();
        let steps = 0;
        try {
          do {
            if (signal?.aborted) {
              abort();
              return;
            }

            const result = iterator.next();
            steps++;

            if (signal?.aborted) {
              abort();
              return;
            }

            if (result.done) {
              complete(result.value);
              return;
            }
          } while (
            steps < maxStepsPerSlice &&
            performance.now() - startedAt < maxSliceMs &&
            deadline.timeRemaining() > minRemainingMs
          );

          schedule();
        } catch (error) {
          fail(error);
        } finally {
          running = false;
        }
      };

      const schedule = () => {
        if (settled) return;
        idleId = window.requestIdleCallback(step, {
          timeout
        });
      };

      signal?.addEventListener("abort", onAbort, { once: true });

      // 处理任务初始化期间发生的取消
      if (signal?.aborted) {
        abort();
        return;
      }
      try {
        schedule();
      } catch (error) {
        fail(error);
      }
    });
  }

  static runAsync<R>(
    task: AsyncTask<R>,
    { signal, timeout = 1000, minRemainingMs = 1 }: RendererIdleAsyncOptions = {}
  ): Promise<R> {
    if (
      !Number.isFinite(timeout) ||
      timeout <= 0 ||
      !Number.isFinite(minRemainingMs) ||
      minRemainingMs < 0
    ) {
      return Promise.reject(new RangeError("Invalid RendererIdle options"));
    }

    const abortReason = () => signal?.reason ?? new DOMException("Task aborted", "AbortError");

    if (signal?.aborted) return Promise.reject(abortReason());
    return new Promise<R>((resolve, reject) => {
      let iterator: AsyncGenerator<unknown, R, unknown>;

      try {
        iterator = task();
      } catch (error) {
        reject(error);
        return;
      }

      let idleId: number | undefined;
      let settled = false;
      let started = false;

      const cleanup = () => {
        if (idleId !== undefined) {
          window.cancelIdleCallback(idleId);
          idleId = undefined;
        }
        signal?.removeEventListener("abort", onAbort);
      };
      const complete = (value: R) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const closeGenerator = () => {
        if (!started) return;
        try {
          // 可能需要等待正在进行的 await 完成
          // 不阻塞取消流程
          void iterator.return(undefined as R).catch(() => {});
        } catch {
          // 不覆盖原始取消原因
        }
      };
      const onAbort = () => {
        if (settled) return;
        fail(abortReason());
        closeGenerator();
      };
      const schedule = () => {
        if (settled) return;
        idleId = window.requestIdleCallback(step, {
          timeout
        });
      };

      const step = (deadline: IdleDeadline) => {
        idleId = undefined;
        if (settled) return;
        if (signal?.aborted) {
          onAbort();
          return;
        }

        // 没有足够空闲时间则等待下次调度
        // 超时触发的回调至少推进一次，防止饥饿
        if (!deadline.didTimeout && deadline.timeRemaining() <= minRemainingMs) {
          try {
            schedule();
          } catch (error) {
            fail(error);
            closeGenerator();
          }
          return;
        }

        started = true;

        try {
          void iterator.next().then(
            ({ done, value }) => {
              if (settled) return;
              if (signal?.aborted) {
                onAbort();
                return;
              }
              if (done) {
                complete(value);
                return;
              }
              // 遇到 yield，重新等待浏览器空闲
              try {
                schedule();
              } catch (error) {
                fail(error);
                closeGenerator();
              }
            },
            (error) => fail(error)
          );
        } catch (error) {
          fail(error);
        }
      };

      signal?.addEventListener("abort", onAbort, { once: true });

      if (signal?.aborted) {
        onAbort();
        return;
      }
      try {
        schedule();
      } catch (error) {
        fail(error);
      }
    });
  }

  static normal(callback: IdleRequestCallback, timeout = 1_000) {
    return window.requestIdleCallback(callback, { timeout });
  }
}
