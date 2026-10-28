import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

import { MainChildEntry } from "../../src/lib/child-entry";
import type { MainChildEntryOptions } from "../../src/lib/child-entry";
import type { ResultMessage, ControlMessage } from "../../src/types/child";

const mocks = vi.hoisted(() => ({ whenReady: vi.fn(), fork: vi.fn() }));
vi.mock("electron", () => ({
  app: { whenReady: mocks.whenReady },
  utilityProcess: { fork: mocks.fork }
}));
vi.mock("../../src/lib/log", () => ({
  Log: {
    currentLevel: 50,
    JsonCompact: (value: unknown) => value,
    JsonFlat: (value: unknown) => value,
    Exclude: () => ({})
  }
}));

class TestChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  postMessage = vi.fn((message: ControlMessage) => {
    if (message.type === "stop") this.emit("exit", 0);
  });
  kill = vi.fn(() => this.emit("exit", 0));
}

class Entry extends MainChildEntry<ControlMessage, ResultMessage> {
  constructor(options: Partial<MainChildEntryOptions> = {}) {
    super({
      metaUrl: import.meta.url,
      childPath: "./child.mjs",
      serviceName: "ncm",
      logger: vi.fn(),
      onPanicError: vi.fn(),
      readyTimeout: 100,
      ...options
    });
  }
  protected buildStartMessage(): ControlMessage & { type: "start" } {
    return { type: "start" };
  }
  protected buildStopMessage(): ControlMessage & { type: "stop" } {
    return { type: "stop" };
  }
  protected handleChildMessage() {}
}

describe("MainChildEntry 启停边界", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.whenReady.mockResolvedValue(undefined);
    mocks.fork.mockImplementation(() => new TestChild());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const waitForFork = async () => {
    await vi.advanceTimersByTimeAsync(0);
    return mocks.fork.mock.results.at(-1)!.value as TestChild;
  };

  it.each([0, 1])("ready 前 exit(%s) 会拒绝启动，且不重复上报 panic", async (code) => {
    const onPanicError = vi.fn();
    const entry = new Entry({ onPanicError });
    const child = await waitForFork();
    const rejected = expect(entry.ready()).rejects.toThrow(`exited before ready: ${code}`);
    child.emit("exit", code);
    await rejected;
    expect(child.listenerCount("message")).toBe(1);
    expect(child.listenerCount("exit")).toBe(1);
    expect(onPanicError).not.toHaveBeenCalled();
  });

  it.each(["error", "panic message"])("ready 前 %s 会拒绝启动并清理子进程", async (kind) => {
    const onPanicError = vi.fn();
    const entry = new Entry({ onPanicError });
    const child = await waitForFork();
    const rejected = expect(entry.ready()).rejects.toThrow(
      kind === "error" ? "FatalError at fixture" : "failed before ready"
    );
    if (kind === "error") child.emit("error", "FatalError", "fixture", "diagnostic report");
    else
      child.emit("message", {
        type: "error",
        error: { name: "panic", message: "failed before ready" }
      });
    await rejected;
    expect(child.postMessage).toHaveBeenLastCalledWith({ type: "stop" });
    expect(child.listenerCount("message")).toBe(1);
    expect(onPanicError).not.toHaveBeenCalled();
  });

  it("ready 超时后拒绝启动并清理等待监听器", async () => {
    const entry = new Entry();
    const child = await waitForFork();
    const rejected = expect(entry.ready()).rejects.toThrow("start timed out");
    await vi.advanceTimersByTimeAsync(100);
    await rejected;
    expect(child.listenerCount("message")).toBe(1);
    expect(child.listenerCount("exit")).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("停止 app ready 前的启动后不会延迟 fork", async () => {
    const appReady = Promise.withResolvers<void>();
    mocks.whenReady.mockReturnValue(appReady.promise);
    const entry = new Entry();
    const rejected = expect(entry.ready()).rejects.toThrow("start cancelled");
    const stopping = entry.stop();
    expect(entry.stop()).toBe(stopping);
    await stopping;
    await rejected;
    appReady.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.fork).not.toHaveBeenCalled();
  });

  it("fork 抛错会由 ready 向上传递", async () => {
    mocks.fork.mockImplementation(() => {
      throw new Error("fork failed");
    });
    const entry = new Entry();
    await expect(entry.ready()).rejects.toThrow("fork failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("beforeStart 未完成时停止也不会延迟 fork", async () => {
    const preparing = Promise.withResolvers<void>();
    class PreparingEntry extends Entry {
      protected override beforeStart() {
        return preparing.promise;
      }
    }
    const entry = new PreparingEntry();
    await vi.advanceTimersByTimeAsync(0);
    const rejected = expect(entry.ready()).rejects.toThrow("start cancelled");
    await entry.stop();
    await rejected;
    preparing.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.fork).not.toHaveBeenCalled();
  });

  it("ready 紧接着的 panic 不会被启动状态吞掉", async () => {
    const onPanicError = vi.fn();
    const entry = new Entry({ onPanicError });
    const child = await waitForFork();
    child.emit("message", { type: "ready" });
    child.emit("message", { type: "error", error: { name: "panic", message: "runtime failed" } });
    await entry.ready();
    expect(onPanicError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: "runtime failed" })
    );
    await entry.stop();
  });

  it("ready 后不会被旧启动超时中断，并且停止只发送一次", async () => {
    const onPanicError = vi.fn();
    const entry = new Entry({ onPanicError });
    const child = await waitForFork();
    child.emit("message", { type: "ready" });
    await entry.ready();
    await vi.advanceTimersByTimeAsync(100);
    expect(child.kill).not.toHaveBeenCalled();
    const stopping = entry.stop();
    expect(entry.stop()).toBe(stopping);
    await stopping;
    expect(
      child.postMessage.mock.calls.filter(([message]) => message.type === "stop")
    ).toHaveLength(1);
    expect(child.listenerCount("exit")).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(onPanicError).not.toHaveBeenCalled();
  });
});
