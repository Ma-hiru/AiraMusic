import {
  type Task,
  RendererIdle,
  type AsyncTask,
  type RendererIdleOptions,
  type RendererIdleAsyncOptions
} from "@mahiru/ui/common/lib/idle";

type PendingIdle = {
  id: number;
  options?: IdleRequestOptions;
  callback: IdleRequestCallback;
};

/**
 * 可手动驱动的 requestIdleCallback 调度器。
 *
 * jsdom 没有实现空闲回调，而 RendererIdle 的切片行为完全由 deadline 决定，
 * 所以由用例接管调度：什么时候给出时间片、剩余时间是多少，全在这里控制。
 */
class FakeIdleScheduler {
  readonly cancelled: number[] = [];
  readonly queued: PendingIdle[] = [];
  private nextID = 1;

  readonly request = vi.fn(
    (callback: IdleRequestCallback, options?: IdleRequestOptions): number => {
      const id = this.nextID++;
      this.queued.push({ id, callback, options });
      return id;
    }
  );

  readonly cancel = vi.fn((id: number): void => {
    this.cancelled.push(id);
    const index = this.queued.findIndex((entry) => entry.id === id);
    if (index !== -1) this.queued.splice(index, 1);
  });

  get pending(): number {
    return this.queued.length;
  }

  last(): undefined | PendingIdle {
    return this.queued.at(-1);
  }

  install(): void {
    vi.stubGlobal("requestIdleCallback", this.request);
    vi.stubGlobal("cancelIdleCallback", this.cancel);
  }

  /** 给出一个空闲时间片：执行最早排队的回调 */
  tick(timeRemaining = 50, didTimeout = false): boolean {
    const entry = this.queued.shift();
    if (!entry) return false;
    const deadline: IdleDeadline = { didTimeout, timeRemaining: () => timeRemaining };
    entry.callback(deadline);
    return true;
  }

  /** 连续给出空闲时间片，直到任务不再申请回调 */
  drain(timeRemaining = 50, maxSlices = 500): number {
    let slices = 0;
    while (slices < maxSlices && this.tick(timeRemaining)) slices++;
    return slices;
  }
}

/** 构造一个 yield 指定次数后返回给定值的任务 */
function repeat(yields: number, value = "result"): Task<string> {
  return function* (): Generator<unknown, string, unknown> {
    for (let i = 0; i < yields; i++) yield i;
    return value;
  };
}

/** 构造一个 yield 指定次数后返回给定值的异步任务 */
function repeatAsync(yields: number, value = "result"): AsyncTask<string> {
  return async function* (): AsyncGenerator<unknown, string, unknown> {
    for (let i = 0; i < yields; i++) yield i;
    return value;
  };
}

/** 模拟清理阶段失败：通过函数间接抛出，避免 no-unsafe-finally 直接命中字面量 throw */
function throwCleanupError(): never {
  throw new Error("cleanup failed");
}

/**
 * 等待微任务与宏任务队列清空。
 * 异步生成器每推进一步都要经过若干次 await，必须给足调度机会再断言。
 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let scheduler: FakeIdleScheduler;

/** 给出一个空闲时间片，并等待异步任务推进 */
async function advance(timeRemaining = 50, didTimeout = false): Promise<boolean> {
  const ticked = scheduler.tick(timeRemaining, didTimeout);
  await flush();
  return ticked;
}

/** 连续给出空闲时间片，直到异步任务不再申请回调 */
async function drainAsync(rounds = 100): Promise<number> {
  let slices = 0;
  while (slices < rounds && (await advance())) slices++;
  return slices;
}

beforeEach(() => {
  scheduler = new FakeIdleScheduler();
  scheduler.install();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RendererIdle.run 完成与调度", () => {
  it("resolves with the value returned by the generator", async () => {
    const promise = RendererIdle.run(repeat(2, "finished"));

    expect(scheduler.request).toHaveBeenCalledTimes(1);
    expect(scheduler.last()?.options).toEqual({ timeout: 1000 });

    expect(scheduler.drain()).toBe(1);
    await expect(promise).resolves.toBe("finished");
  });

  it("forwards a custom timeout to requestIdleCallback", async () => {
    const promise = RendererIdle.run(repeat(1), { timeout: 250 });

    expect(scheduler.last()?.options).toEqual({ timeout: 250 });

    scheduler.drain();
    await expect(promise).resolves.toBe("result");
  });

  it("runs a task with a generous deadline inside a single slice", async () => {
    const promise = RendererIdle.run(repeat(4));

    expect(scheduler.drain()).toBe(1);
    await expect(promise).resolves.toBe("result");
    expect(scheduler.request).toHaveBeenCalledTimes(1);
  });

  it("finishes an empty generator in the first slice", async () => {
    const promise = RendererIdle.run(repeat(0, "immediate"));

    expect(scheduler.drain()).toBe(1);
    await expect(promise).resolves.toBe("immediate");
    expect(scheduler.request).toHaveBeenCalledTimes(1);
  });

  it("requests a new slice once the deadline is exhausted", async () => {
    const progress: number[] = [];
    function* track(): Generator<unknown, string, unknown> {
      for (let i = 0; i < 3; i++) {
        progress.push(i);
        yield i;
      }
      return "finished";
    }

    const promise = RendererIdle.run(track);

    expect(scheduler.tick(0)).toBe(true);
    expect(progress).toEqual([0]);
    expect(scheduler.pending).toBe(1);

    expect(scheduler.tick(0)).toBe(true);
    expect(progress).toEqual([0, 1]);

    expect(scheduler.drain(0)).toBe(2);
    await expect(promise).resolves.toBe("finished");
    expect(scheduler.request).toHaveBeenCalledTimes(4);
  });

  it("caps the number of steps executed per slice", async () => {
    const progress: number[] = [];
    function* track(): Generator<unknown, string, unknown> {
      for (let i = 0; i < 5; i++) {
        progress.push(i);
        yield i;
      }
      return "finished";
    }

    const promise = RendererIdle.run(track, { maxStepsPerSlice: 2 });

    expect(scheduler.tick()).toBe(true);
    expect(progress).toEqual([0, 1]);
    expect(scheduler.pending).toBe(1);

    expect(scheduler.tick()).toBe(true);
    expect(progress).toEqual([0, 1, 2, 3]);

    expect(scheduler.drain()).toBe(1);
    await expect(promise).resolves.toBe("finished");
    expect(scheduler.request).toHaveBeenCalledTimes(3);
  });

  it("stops a slice once maxSliceMs has elapsed", async () => {
    // 每次读取时间都前进 100ms，任何一次判断都会超出 8ms 的切片上限
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 100));

    const promise = RendererIdle.run(repeat(2));

    expect(scheduler.drain()).toBe(3);
    await expect(promise).resolves.toBe("result");
    expect(scheduler.request).toHaveBeenCalledTimes(3);
  });

  it("keeps working while the remaining time exceeds minRemainingMs", async () => {
    const promise = RendererIdle.run(repeat(3), { minRemainingMs: 5 });

    expect(scheduler.drain(6)).toBe(1);
    await expect(promise).resolves.toBe("result");
  });

  it("stops when the remaining time only reaches minRemainingMs", async () => {
    const promise = RendererIdle.run(repeat(3), { minRemainingMs: 5 });

    // 阈值比较是严格大于，剩余时间恰好等于阈值时让出
    expect(scheduler.drain(5)).toBe(4);
    await expect(promise).resolves.toBe("result");
  });

  it("keeps concurrent runs independent", async () => {
    const controller = new AbortController();
    const slow = RendererIdle.run(repeat(3, "slow"), { signal: controller.signal });
    const fast = RendererIdle.run(repeat(0, "fast"));

    expect(scheduler.drain()).toBe(2);

    await expect(fast).resolves.toBe("fast");
    await expect(slow).resolves.toBe("slow");

    controller.abort();
    await expect(fast).resolves.toBe("fast");
  });
});

describe("RendererIdle.run 取消", () => {
  it("rejects without starting the task when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn(repeat(1));

    const promise = RendererIdle.run(task, { signal: controller.signal });

    await expect(promise).rejects.toBe(controller.signal.reason);
    expect(task).not.toHaveBeenCalled();
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("aborts a task that is waiting for the next slice", async () => {
    const controller = new AbortController();
    const events: string[] = [];
    function* guarded(): Generator<unknown, string, unknown> {
      try {
        for (let i = 0; i < 5; i++) {
          events.push(`step-${i}`);
          yield i;
        }
        return "finished";
      } finally {
        events.push("finalized");
      }
    }

    const promise = RendererIdle.run(guarded, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    scheduler.tick(0);
    expect(events).toEqual(["step-0"]);
    const waiting = scheduler.last();
    expect(waiting).toBeDefined();

    controller.abort();

    expect(scheduler.cancelled).toEqual([waiting?.id]);
    expect(scheduler.pending).toBe(0);
    await expect(outcome).resolves.toBe(controller.signal.reason);
    // 取消必须触发 Generator 的 finally，让调用方释放占用的资源
    expect(events).toEqual(["step-0", "finalized"]);
  });

  it("rejects with an AbortError when the signal aborts without a reason", async () => {
    const controller = new AbortController();
    const promise = RendererIdle.run(repeat(4), { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    scheduler.tick(0);
    controller.abort();

    expect(await outcome).toHaveProperty("name", "AbortError");
  });

  it("propagates a custom abort reason", async () => {
    const controller = new AbortController();
    const reason = new Error("user cancelled");
    const promise = RendererIdle.run(repeat(4), { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    scheduler.tick(0);
    controller.abort(reason);

    await expect(outcome).resolves.toBe(reason);
  });

  it("defers an abort raised inside a step until the generator is idle", async () => {
    const controller = new AbortController();
    const events: string[] = [];

    function* selfAbort(): Generator<unknown, string, unknown> {
      try {
        events.push("first");
        yield 1;
        controller.abort();
        events.push("resumed");
        yield 2;
      } finally {
        events.push("finalized");
      }
      return "unreachable";
    }

    const promise = RendererIdle.run(selfAbort, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    // 取消发生在 iterator.next() 执行期间，不能在此时调用 iterator.return()
    expect(scheduler.drain()).toBe(1);

    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(events).toEqual(["first", "resumed", "finalized"]);
    expect(scheduler.cancelled).toEqual([]);
  });

  it("ignores an abort after the task has completed", async () => {
    const controller = new AbortController();
    const promise = RendererIdle.run(repeat(1, "done"), { signal: controller.signal });

    scheduler.drain();
    await expect(promise).resolves.toBe("done");

    controller.abort();
    await expect(promise).resolves.toBe("done");
    expect(scheduler.cancelled).toEqual([]);
  });
});

describe("RendererIdle.run 异常", () => {
  it("rejects when the task factory throws", async () => {
    const factory = vi.fn(() => {
      throw new Error("factory exploded");
    });

    await expect(RendererIdle.run(factory)).rejects.toThrow("factory exploded");
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("rejects when the generator throws mid-way", async () => {
    function* explode(): Generator<unknown, string, unknown> {
      yield 1;
      throw new Error("generator exploded");
    }

    const promise = RendererIdle.run(explode);
    const assertion = expect(promise).rejects.toThrow("generator exploded");

    scheduler.drain();
    await assertion;
    expect(scheduler.request).toHaveBeenCalledTimes(1);
  });

  it("rejects when the idle scheduler is unavailable", async () => {
    scheduler.request.mockImplementationOnce(() => {
      throw new Error("idle callback unavailable");
    });

    await expect(RendererIdle.run(repeat(1))).rejects.toThrow("idle callback unavailable");
  });
});

describe("RendererIdle.run 参数校验", () => {
  const invalidOptions: Array<[label: string, options: RendererIdleOptions]> = [
    ["timeout = 0", { timeout: 0 }],
    ["timeout < 0", { timeout: -1 }],
    ["timeout = NaN", { timeout: Number.NaN }],
    ["timeout = Infinity", { timeout: Number.POSITIVE_INFINITY }],
    ["maxSliceMs = 0", { maxSliceMs: 0 }],
    ["maxSliceMs < 0", { maxSliceMs: -1 }],
    ["maxStepsPerSlice = 0", { maxStepsPerSlice: 0 }],
    ["maxStepsPerSlice = 1.5", { maxStepsPerSlice: 1.5 }],
    ["minRemainingMs < 0", { minRemainingMs: -1 }],
    ["minRemainingMs = NaN", { minRemainingMs: Number.NaN }]
  ];

  it.each(invalidOptions)("rejects %s before starting the task", async (_label, options) => {
    const task = vi.fn(repeat(1));

    await expect(RendererIdle.run(task, options)).rejects.toThrow(RangeError);

    expect(task).not.toHaveBeenCalled();
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("accepts minRemainingMs = 0 and maxStepsPerSlice = 1", async () => {
    const promise = RendererIdle.run(repeat(2), {
      minRemainingMs: 0,
      maxStepsPerSlice: 1
    });

    expect(scheduler.drain(0.5)).toBe(3);
    await expect(promise).resolves.toBe("result");
  });
});

describe("RendererIdle.runAsync 完成与调度", () => {
  it("resolves with the value returned by the async generator", async () => {
    const promise = RendererIdle.runAsync(repeatAsync(0, "finished"));

    expect(scheduler.request).toHaveBeenCalledTimes(1);
    expect(scheduler.last()?.options).toEqual({ timeout: 1000 });

    expect(await drainAsync()).toBe(1);
    await expect(promise).resolves.toBe("finished");
    expect(scheduler.pending).toBe(0);
  });

  it("forwards a custom timeout to requestIdleCallback", async () => {
    const promise = RendererIdle.runAsync(repeatAsync(0), { timeout: 250 });

    expect(scheduler.last()?.options).toEqual({ timeout: 250 });

    await drainAsync();
    await expect(promise).resolves.toBe("result");
  });

  it("waits for a new idle slice after every yield", async () => {
    const promise = RendererIdle.runAsync(repeatAsync(3, "finished"));

    expect(await drainAsync()).toBe(4);
    await expect(promise).resolves.toBe("finished");
    // 初始调度一次，之后每次 yield 都重新排队
    expect(scheduler.request).toHaveBeenCalledTimes(4);
  });

  it("postpones the work when the remaining time does not exceed minRemainingMs", async () => {
    const progress: number[] = [];
    async function* track(): AsyncGenerator<unknown, string, unknown> {
      for (let i = 0; i < 2; i++) {
        progress.push(i);
        yield i;
      }
      return "finished";
    }

    const promise = RendererIdle.runAsync(track);

    expect(await advance(1)).toBe(true);
    expect(progress).toEqual([]);
    expect(scheduler.pending).toBe(1);

    await drainAsync();
    await expect(promise).resolves.toBe("finished");
    expect(progress).toEqual([0, 1]);
  });

  it("advances anyway when the idle callback was triggered by the timeout", async () => {
    const progress: number[] = [];
    async function* track(): AsyncGenerator<unknown, string, unknown> {
      progress.push(0);
      yield 0;
      return "finished";
    }

    const promise = RendererIdle.runAsync(track, { minRemainingMs: 5 });

    // 超时触发的回调即使没有剩余时间也要推进一次，避免任务饿死
    expect(await advance(0, true)).toBe(true);
    expect(progress).toEqual([0]);

    await drainAsync();
    await expect(promise).resolves.toBe("finished");
  });

  it("keeps the run pending while the generator awaits", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    async function* slow(): AsyncGenerator<unknown, string, unknown> {
      await gate;
      yield 1;
      return "finished";
    }

    const promise = RendererIdle.runAsync(slow);

    scheduler.tick();
    await flush();
    // 生成器停在 await 上，既没有完成也没有重新排队
    expect(scheduler.pending).toBe(0);

    release();
    await flush();
    expect(scheduler.pending).toBe(1);

    await drainAsync();
    await expect(promise).resolves.toBe("finished");
  });

  it("keeps concurrent async runs independent", async () => {
    const controller = new AbortController();
    const slow = RendererIdle.runAsync(repeatAsync(2, "slow"), { signal: controller.signal });
    const fast = RendererIdle.runAsync(repeatAsync(0, "fast"));

    await drainAsync();

    await expect(fast).resolves.toBe("fast");
    await expect(slow).resolves.toBe("slow");

    controller.abort();
    await expect(fast).resolves.toBe("fast");
  });

  it("removes its abort listener once the run settles", async () => {
    const controller = new AbortController();
    const removeListener = vi.spyOn(controller.signal, "removeEventListener");

    const promise = RendererIdle.runAsync(repeatAsync(0, "finished"), {
      signal: controller.signal
    });

    await drainAsync();
    await expect(promise).resolves.toBe("finished");

    expect(removeListener).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  it("keeps one advance per idle slice over a long task", async () => {
    const total = 200;
    const advances: number[] = [];
    async function* long(): AsyncGenerator<unknown, string, unknown> {
      for (let i = 0; i < total; i++) {
        advances.push(i);
        yield i;
      }
      return "finished";
    }

    const promise = RendererIdle.runAsync(long);

    expect(await drainAsync(total + 5)).toBe(total + 1);
    await expect(promise).resolves.toBe("finished");
    expect(advances).toHaveLength(total);
    expect(scheduler.request).toHaveBeenCalledTimes(total + 1);
  });

  it("coexists with a synchronous run on the same scheduler", async () => {
    const sync = RendererIdle.run(repeat(2, "sync"));
    const asyncRun = RendererIdle.runAsync(repeatAsync(2, "async"));

    for (let guard = 0; guard < 20 && scheduler.pending > 0; guard++) {
      scheduler.tick();
      await flush();
    }

    await expect(sync).resolves.toBe("sync");
    await expect(asyncRun).resolves.toBe("async");
    expect(scheduler.pending).toBe(0);
  });
});

describe("RendererIdle.runAsync 取消", () => {
  it("rejects without starting the task when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const task = vi.fn(repeatAsync(1));

    const promise = RendererIdle.runAsync(task, { signal: controller.signal });

    await expect(promise).rejects.toBe(controller.signal.reason);
    expect(task).not.toHaveBeenCalled();
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("aborts while waiting for the next idle slice", async () => {
    const controller = new AbortController();
    const finalized: string[] = [];
    async function* guarded(): AsyncGenerator<unknown, string, unknown> {
      try {
        for (let i = 0; i < 5; i++) yield i;
        return "finished";
      } finally {
        finalized.push("finalized");
      }
    }

    const promise = RendererIdle.runAsync(guarded, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    expect(scheduler.pending).toBe(1);
    const waiting = scheduler.last();

    controller.abort();
    await flush();

    expect(scheduler.cancelled).toEqual([waiting?.id]);
    expect(scheduler.pending).toBe(0);
    await expect(outcome).resolves.toBe(controller.signal.reason);
    // 取消必须触发异步生成器的 finally，让调用方释放占用的资源
    expect(finalized).toEqual(["finalized"]);
  });

  it("rejects immediately instead of waiting for a pending await", async () => {
    const controller = new AbortController();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finalized: string[] = [];
    async function* blocked(): AsyncGenerator<unknown, string, unknown> {
      try {
        await gate;
        yield 1;
        return "finished";
      } finally {
        finalized.push("finalized");
      }
    }

    const promise = RendererIdle.runAsync(blocked, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    scheduler.tick();
    await flush();

    controller.abort();

    // 取消不能阻塞在挂起的 await 上
    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(finalized).toEqual([]);

    // return() 已排队，await 结束后才轮到 finally
    release();
    await flush();
    expect(finalized).toEqual(["finalized"]);
  });

  it("aborts before the first idle callback without entering the generator", async () => {
    const controller = new AbortController();
    let entered = false;
    async function* neverStarted(): AsyncGenerator<unknown, string, unknown> {
      entered = true;
      yield 1;
      return "finished";
    }

    const promise = RendererIdle.runAsync(neverStarted, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );
    const waiting = scheduler.last();
    expect(scheduler.pending).toBe(1);

    controller.abort();
    await flush();

    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(scheduler.cancelled).toEqual([waiting?.id]);
    expect(scheduler.pending).toBe(0);
    // 生成器从未启动，不应该被执行
    expect(entered).toBe(false);
  });

  it("handles an abort raised inside the generator body", async () => {
    const controller = new AbortController();
    const finalized: string[] = [];
    async function* selfAbort(): AsyncGenerator<unknown, string, unknown> {
      try {
        controller.abort();
        yield 1;
        return "finished";
      } finally {
        finalized.push("finalized");
      }
    }

    const promise = RendererIdle.runAsync(selfAbort, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();

    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(finalized).toEqual(["finalized"]);
    expect(scheduler.pending).toBe(0);
  });

  it("runs the generator's finally once even when the signal aborts twice", async () => {
    const controller = new AbortController();
    const finalized: string[] = [];
    async function* guarded(): AsyncGenerator<unknown, string, unknown> {
      try {
        for (let i = 0; i < 3; i++) yield i;
        return "finished";
      } finally {
        finalized.push("finalized");
      }
    }

    const promise = RendererIdle.runAsync(guarded, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort();
    controller.abort();
    await flush();

    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(finalized).toEqual(["finalized"]);
  });

  it("stops requesting idle callbacks once the abort is handled", async () => {
    const controller = new AbortController();
    const promise = RendererIdle.runAsync(repeatAsync(10), { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    const requests = scheduler.request.mock.calls.length;

    controller.abort();
    await flush();
    await flush();

    await outcome;
    expect(scheduler.request.mock.calls.length).toBe(requests);
    expect(scheduler.pending).toBe(0);
  });

  it("rejects with an AbortError when the signal aborts without a reason", async () => {
    const controller = new AbortController();
    const promise = RendererIdle.runAsync(repeatAsync(4), { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort();

    expect(await outcome).toHaveProperty("name", "AbortError");
  });

  it("propagates a custom abort reason", async () => {
    const controller = new AbortController();
    const reason = new Error("user cancelled");
    const promise = RendererIdle.runAsync(repeatAsync(4), { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort(reason);

    await expect(outcome).resolves.toBe(reason);
  });

  it("ignores an abort after the task has completed", async () => {
    const controller = new AbortController();
    const promise = RendererIdle.runAsync(repeatAsync(0, "done"), { signal: controller.signal });

    await drainAsync();
    await expect(promise).resolves.toBe("done");

    controller.abort();
    await expect(promise).resolves.toBe("done");
    expect(scheduler.cancelled).toEqual([]);
  });

  it("ignores a stale idle callback fired after the run settled", async () => {
    const controller = new AbortController();
    let advances = 0;
    async function* counted(): AsyncGenerator<unknown, string, unknown> {
      for (let i = 0; i < 3; i++) {
        advances++;
        yield i;
      }
      return "finished";
    }

    const promise = RendererIdle.runAsync(counted, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    const stale = scheduler.queued[0];
    const before = advances;

    controller.abort();
    await flush();

    // 浏览器不保证一定不调用已取消的回调，重复触发也必须无害
    stale?.callback({ didTimeout: false, timeRemaining: () => 50 });
    await flush();

    await expect(outcome).resolves.toBe(controller.signal.reason);
    expect(advances).toBe(before);
  });

  it("does not cancel a run that shares the scheduler", async () => {
    const controller = new AbortController();
    const survivor = RendererIdle.runAsync(repeatAsync(2, "survivor"));
    const doomed = RendererIdle.runAsync(repeatAsync(2, "doomed"), {
      signal: controller.signal
    });
    const doomedOutcome = doomed.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort();
    await flush();

    await expect(doomedOutcome).resolves.toBe(controller.signal.reason);

    await drainAsync();
    await expect(survivor).resolves.toBe("survivor");
  });

  it("reuses one signal across sequential runs", async () => {
    const controller = new AbortController();

    const first = RendererIdle.runAsync(repeatAsync(0, "first"), { signal: controller.signal });
    await drainAsync();
    await expect(first).resolves.toBe("first");

    const second = RendererIdle.runAsync(repeatAsync(3, "second"), {
      signal: controller.signal
    });
    const outcome = second.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort();

    await expect(outcome).resolves.toBe(controller.signal.reason);
  });

  it("keeps the abort reason when the generator's finally throws", async () => {
    const controller = new AbortController();
    async function* brokenFinally(): AsyncGenerator<unknown, string, unknown> {
      try {
        for (let i = 0; i < 3; i++) yield i;
        return "finished";
      } finally {
        throwCleanupError();
      }
    }

    const promise = RendererIdle.runAsync(brokenFinally, { signal: controller.signal });
    const outcome = promise.then(
      () => "resolved",
      (error: unknown) => error
    );

    await advance();
    controller.abort();
    await flush();

    await expect(outcome).resolves.toBe(controller.signal.reason);
  });

  it("rejects when the task factory aborts the signal synchronously", async () => {
    const controller = new AbortController();
    let entered = false;

    const task = () => {
      controller.abort("cancelled during setup");
      return (async function* (): AsyncGenerator<unknown, string, unknown> {
        entered = true;
        yield 1;
        return "finished";
      })();
    };

    const promise = RendererIdle.runAsync(task, { signal: controller.signal });

    await expect(promise).rejects.toBe("cancelled during setup");
    expect(entered).toBe(false);
    expect(scheduler.request).not.toHaveBeenCalled();
  });
});

describe("RendererIdle.runAsync 不变量", () => {
  it("settles once and stops all activity whatever the abort timing", async () => {
    for (const abortAt of [0, 1, 2, 4]) {
      scheduler = new FakeIdleScheduler();
      scheduler.install();

      const controller = new AbortController();
      let finalized = 0;
      async function* gen(): AsyncGenerator<unknown, string, unknown> {
        try {
          for (let i = 0; i < 6; i++) yield i;
          return "finished";
        } finally {
          finalized++;
        }
      }

      const promise = RendererIdle.runAsync(gen, { signal: controller.signal });
      const outcome = promise.then(
        (value) => ({ status: "resolved" as const, value }),
        (error: unknown) => ({ status: "rejected" as const, error })
      );

      for (let i = 0; i < abortAt && scheduler.pending > 0; i++) await advance();
      controller.abort();
      await flush();

      const result = await outcome;
      expect(result.status).toBe("rejected");
      expect(result).toHaveProperty("error", controller.signal.reason);

      const requests = scheduler.request.mock.calls.length;
      await drainAsync();
      expect(scheduler.request.mock.calls.length).toBe(requests);
      expect(scheduler.pending).toBe(0);
      expect(finalized).toBeLessThanOrEqual(1);
    }
  });
});

describe("RendererIdle.runAsync 异常", () => {
  it("rejects when the task factory throws", async () => {
    const factory = vi.fn(() => {
      throw new Error("factory exploded");
    });

    await expect(RendererIdle.runAsync(factory)).rejects.toThrow("factory exploded");
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("rejects when the async generator throws", async () => {
    async function* explode(): AsyncGenerator<unknown, string, unknown> {
      yield 1;
      throw new Error("async generator exploded");
    }

    const promise = RendererIdle.runAsync(explode);
    const assertion = expect(promise).rejects.toThrow("async generator exploded");

    await drainAsync();
    await assertion;
  });

  it("rejects when the idle scheduler is unavailable", async () => {
    scheduler.request.mockImplementationOnce(() => {
      throw new Error("idle callback unavailable");
    });

    await expect(RendererIdle.runAsync(repeatAsync(0))).rejects.toThrow(
      "idle callback unavailable"
    );
  });

  it("rejects and finalizes the generator when rescheduling fails after a yield", async () => {
    const finalized: string[] = [];
    async function* gen(): AsyncGenerator<unknown, string, unknown> {
      try {
        yield 1;
      } finally {
        finalized.push("finalized");
      }
      return "finished";
    }

    const promise = RendererIdle.runAsync(gen);
    const assertion = expect(promise).rejects.toThrow("reschedule failed");

    scheduler.request.mockImplementationOnce(() => {
      throw new Error("reschedule failed");
    });

    await advance();
    await assertion;
    await flush();

    expect(finalized).toEqual(["finalized"]);
  });

  it("finalizes the generator when rescheduling from the idle-time gate fails", async () => {
    const finalized: string[] = [];
    async function* gen(): AsyncGenerator<unknown, string, unknown> {
      try {
        for (let i = 0; i < 3; i++) yield i;
        return "finished";
      } finally {
        finalized.push("finalized");
      }
    }

    const promise = RendererIdle.runAsync(gen);
    const assertion = expect(promise).rejects.toThrow("gate reschedule failed");

    await advance();
    scheduler.request.mockImplementationOnce(() => {
      throw new Error("gate reschedule failed");
    });

    // 空闲时间不足走等待分支，此时重新排队失败
    await advance(0);

    await assertion;
    await flush();
    expect(finalized).toEqual(["finalized"]);
  });
});

describe("RendererIdle.runAsync 参数校验", () => {
  const invalidOptions: Array<[label: string, options: RendererIdleAsyncOptions]> = [
    ["timeout = 0", { timeout: 0 }],
    ["timeout < 0", { timeout: -1 }],
    ["timeout = NaN", { timeout: Number.NaN }],
    ["timeout = Infinity", { timeout: Number.POSITIVE_INFINITY }],
    ["minRemainingMs < 0", { minRemainingMs: -1 }],
    ["minRemainingMs = NaN", { minRemainingMs: Number.NaN }]
  ];

  it.each(invalidOptions)("rejects %s before starting the task", async (_label, options) => {
    const task = vi.fn(repeatAsync(1));

    await expect(RendererIdle.runAsync(task, options)).rejects.toThrow(RangeError);

    expect(task).not.toHaveBeenCalled();
    expect(scheduler.request).not.toHaveBeenCalled();
  });

  it("accepts minRemainingMs = 0", async () => {
    const promise = RendererIdle.runAsync(repeatAsync(0), { minRemainingMs: 0 });

    expect(await drainAsync()).toBe(1);
    await expect(promise).resolves.toBe("result");
  });
});
