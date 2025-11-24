// useWorkerPool.ts
import { useEffect, useRef, useCallback } from "react";

/**
 * Types
 */
export type Priority = "high" | "normal" | "low";

export type RunOptions = {
  priority?: Priority;
  /**
   * Transferables to transfer to the worker when posting the task.
   * Example: [arrayBuffer]
   */
  transfer?: Transferable[];
  /**
   * Optional time in ms: automatic timeout (causes abort)
   */
  timeout?: number;
};

type Task<T extends any[] = any[], R = any> = {
  id: number;
  fnStr: string;
  args: T;
  options: RunOptions;
  resolve: (v: R) => void;
  reject: (e: any) => void;
  // hold AbortController on main thread to allow aborting before posted
  mainController: AbortController;
  // optional timeout id
  timeoutId?: number;
};

type InflightTask = {
  id: number;
  workerIndex: number;
  mainController: AbortController;
  timeoutId?: number;
};

type UseWorkerPoolReturn = {
  /**
   * run a function in the pool.
   * returns: { promise, abort }
   *
   * - fn: a function (sync or async). It should be self-contained (no outer closure).
   * - args: arguments array passed to fn
   *
   * The worker will call: await userFn(...args, signal)
   * NOTE: we append AbortSignal as last parameter so your function can detect aborts:
   *    function myFn(a, b, signal) { if (signal.aborted) throw new Error('aborted'); ... }
   */
  run: <T extends any[], R = any>(
    fn: (...args: [...T, AbortSignal?]) => Promise<R> | R,
    args: T,
    options?: RunOptions
  ) => { promise: Promise<R>; abort: () => void };
  terminate: () => void;
};

/**
 * Hook: useWorkerPool
 * @param size number of workers in pool
 */
export function useWorkerPool(size = 4): UseWorkerPoolReturn {
  const workersRef = useRef<Worker[]>([]);
  const busyRef = useRef<boolean[]>([]); // index -> busy
  const queueRef = useRef<Map<Priority, Task[]>>(new Map());
  const inflightRef = useRef<Map<number, InflightTask>>(new Map());
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const callbacksRef = useRef<Map<number, { resolve: Function; reject: Function }>>(new Map());
  const idRef = useRef(1);
  const mountedRef = useRef(true);

  // init queue buckets
  if (!queueRef.current.has("high")) queueRef.current.set("high", []);
  if (!queueRef.current.has("normal")) queueRef.current.set("normal", []);
  if (!queueRef.current.has("low")) queueRef.current.set("low", []);

  useEffect(() => {
    mountedRef.current = true;

    // worker blob script
    const workerScript = `
      const inflight = new Map();

      self.onmessage = async (e) => {
        const m = e.data;
        if (!m) return;
        if (m.type === 'run') {
          const { id, fnStr, args } = m;
          // create an AbortController for this task
          const ctrl = new AbortController();
          inflight.set(id, ctrl);

          // reconstruct function
          let userFn;
          try {
            userFn = new Function('return (' + fnStr + ')')();
          } catch (err) {
            self.postMessage({ id, error: 'Function parse error: ' + String(err) });
            inflight.delete(id);
            return;
          }

          // if userFn expects signal as last arg, we'll pass it.
          try {
            const maybePromise = userFn(...args, ctrl.signal);
            const result = await Promise.resolve(maybePromise);
            self.postMessage({ id, result });
          } catch (err) {
            // if aborted, signal.reason may not be supported in all browsers; normalize
            const isAbort = ctrl.signal && ctrl.signal.aborted;
            self.postMessage({ id, error: isAbort ? 'aborted' : String(err) });
          } finally {
            inflight.delete(id);
          }
        } else if (m.type === 'abort') {
          const { id } = m;
          const ctrl = inflight.get(id);
          if (ctrl) {
            try {
              ctrl.abort(); // attempt to abort
            } catch (e) {}
            // worker will send postMessage from catch in run
          }
        }
      };
    `;

    const blob = new Blob([workerScript], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);

    // create pool
    for (let i = 0; i < size; i++) {
      const w = new Worker(url);
      const idx = i;
      workersRef.current.push(w);
      busyRef.current.push(false);

      w.onmessage = (ev: MessageEvent) => {
        const { id, result, error } = ev.data ?? {};
        const cb = callbacksRef.current.get(id);
        if (!cb) return;
        // clear inflight / timeout
        const inflight = inflightRef.current.get(id);
        if (inflight) {
          if (inflight.timeoutId) clearTimeout(inflight.timeoutId);
          inflightRef.current.delete(id);
        }

        callbacksRef.current.delete(id);
        busyRef.current[inflight?.workerIndex ?? idx] = false;

        // resolve/reject
        if (error !== undefined) {
          cb.reject(new Error(error));
        } else {
          cb.resolve(result);
        }

        // dispatch next queued tasks
        dispatchQueued();
      };
    }

    URL.revokeObjectURL(url); // workers already created

    return () => {
      mountedRef.current = false;
      // cleanup
      for (const w of workersRef.current) {
        try {
          w.terminate();
        } catch {
          /* empty */
        }
      }
      workersRef.current = [];
      busyRef.current = [];
      // reject pending
      callbacksRef.current.forEach((c) => {
        try {
          c.reject(new Error("Worker pool destroyed"));
        } catch {
          /* empty */
        }
      });
      callbacksRef.current.clear();
      inflightRef.current.forEach((t) => {
        if (t.timeoutId) clearTimeout(t.timeoutId);
      });
      inflightRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const dispatchQueued = () => {
    // find a free worker index
    const workers = workersRef.current;
    const busy = busyRef.current;
    if (!workers || workers.length === 0) return;

    let freeIndex = -1;
    for (let i = 0; i < workers.length; i++) {
      if (!busy[i]) {
        freeIndex = i;
        break;
      }
    }
    if (freeIndex === -1) return; // no free worker

    // pick from high -> normal -> low
    const queue = queueRef.current;
    const pickBuckets: Priority[] = ["high", "normal", "low"];
    let task: Task | undefined;
    let bucketKey: Priority | undefined;
    for (const p of pickBuckets) {
      const arr = queue.get(p)!;
      if (arr.length > 0) {
        task = arr.shift();
        bucketKey = p;
        break;
      }
    }
    if (!task) return; // nothing to do

    // mark busy
    busy[freeIndex] = true;

    // store callback
    callbacksRef.current.set(task.id, { resolve: task.resolve, reject: task.reject });

    // add to inflight
    inflightRef.current.set(task.id, {
      id: task.id,
      workerIndex: freeIndex,
      mainController: task.mainController
    });

    // post message with optional transfer list
    try {
      const payload = {
        type: "run",
        id: task.id,
        fnStr: task.fnStr,
        args: task.args
      };
      // post (transfer if provided)
      if (task.options.transfer && task.options.transfer.length > 0) {
        workers[freeIndex]?.postMessage(payload, task.options.transfer);
      } else {
        workers[freeIndex]?.postMessage(payload);
      }
    } catch (err) {
      // posting error
      busy[freeIndex] = false;
      callbacksRef.current.delete(task.id);
      inflightRef.current.delete(task.id);
      task.reject(err);
      dispatchQueued();
      return;
    }

    // setup timeout if requested
    if (task.options.timeout && task.options.timeout > 0) {
      const to = window.setTimeout(() => {
        // abort on timeout
        task.mainController.abort();
        // notify worker to abort
        workers[freeIndex]?.postMessage({ type: "abort", id: task.id });
      }, task.options.timeout);
      const infl = inflightRef.current.get(task.id);
      if (infl) infl.timeoutId = to;
      task.timeoutId = to;
    }
  };

  const run = useCallback(
    <T extends any[], R = any>(
      fn: (...args: [...T, AbortSignal?]) => Promise<R> | R,
      args: T,
      options: RunOptions = {}
    ): { promise: Promise<R>; abort: () => void } => {
      const id = idRef.current++;
      const fnStr = fn.toString();

      const controller = new AbortController();

      const promise = new Promise<R>((resolve, reject) => {
        // create task
        const task: Task<T, R> = {
          id,
          fnStr,
          args,
          options: {
            priority: options.priority ?? "normal",
            transfer: options.transfer ?? [],
            timeout: options.timeout
          },
          resolve,
          reject,
          mainController: controller
        };

        // push into proper priority queue
        const bucket = queueRef.current.get(task.options.priority!);
        bucket!.push(task);

        // dispatch attempt
        dispatchQueued();
      });

      const abort = () => {
        // if not yet dispatched (still in queue), remove and reject
        // find in queue
        const foundAndRemoved = ["high", "normal", "low"].some((p) => {
          const arr = queueRef.current.get(p as Priority)!;
          const idx = arr.findIndex((t) => t.id === id);
          if (idx >= 0) {
            const [t] = arr.splice(idx, 1);
            try {
              t?.reject(new Error("aborted"));
            } catch {
              /* empty */
            }
            return true;
          }
          return false;
        });

        if (foundAndRemoved) {
          return;
        }

        // if inflight, send abort message to the corresponding worker and abort mainController
        const infl = inflightRef.current.get(id);
        if (infl) {
          // abort main controller
          try {
            infl.mainController.abort();
          } catch {
            /* empty */
          }
          const w = workersRef.current[infl.workerIndex];
          if (w) {
            try {
              w.postMessage({ type: "abort", id });
            } catch {
              /* empty */
            }
          }
        } else {
          // maybe already finished
        }
      };

      return { promise, abort };
    },
    []
  );

  const terminate = useCallback(() => {
    for (const w of workersRef.current) {
      try {
        w.terminate();
      } catch {
        /* empty */
      }
    }
    workersRef.current = [];
    busyRef.current = [];
  }, []);

  return {
    run,
    terminate
  };
}
