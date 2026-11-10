import { PassThrough } from "node:stream";
import { EventEmitter } from "node:events";

import { MainChildEntry } from "../../src/lib/child-entry";
import NeteaseMusicApiService from "../../src/services/ncm";
import type { ResultMessage, ControlMessage } from "../../src/types/child";

const mocks = vi.hoisted(() => ({ whenReady: vi.fn(), fork: vi.fn() }));
vi.mock("electron", () => ({
  app: { whenReady: mocks.whenReady },
  utilityProcess: { fork: mocks.fork }
}));
vi.mock("../../src/lib/path-resolver", () => ({
  MainPathResolver: { appUserDataJoin: (...parts: string[]) => `/userData/${parts.join("/")}` }
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

class OtherService extends MainChildEntry<ControlMessage, ResultMessage> {
  constructor() {
    super({
      metaUrl: import.meta.url,
      childPath: "./other.mjs",
      serviceName: "proxy",
      onPanicError: vi.fn(),
      logger: vi.fn()
    });
  }
  protected buildStartMessage(): Extract<ControlMessage, { type: "start" }> {
    return { type: "start" };
  }
  protected buildStopMessage(): Extract<ControlMessage, { type: "stop" }> {
    return { type: "stop" };
  }
  protected handleChildMessage() {}
}

describe("NCM 首次冷加载的父侧等待预算", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.whenReady.mockResolvedValue(undefined);
    mocks.fork.mockImplementation(() => new TestChild());
  });
  afterEach(() => vi.useRealTimers());

  const createService = () =>
    new NeteaseMusicApiService({
      port: 18927,
      logger: vi.fn(),
      onPanicError: vi.fn()
    });

  it("首次依赖加载超过 15 秒仍可 ready，不会提前杀死 NCM", async () => {
    const entry = createService();
    await vi.advanceTimersByTimeAsync(20_000);
    const child = mocks.fork.mock.results.at(-1)!.value as TestChild;
    expect(child.postMessage).toHaveBeenCalledWith({
      type: "start",
      port: 18927,
      deviceIdPath: "/userData/ncm/deviceId"
    });
    expect(child.kill).not.toHaveBeenCalled();
    expect(child.postMessage).not.toHaveBeenCalledWith({ type: "stop" });
    child.emit("message", { type: "ready", port: 18927 });
    await entry.ready();
    await entry.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("NCM 仍在 60 秒总预算耗尽时拒绝并清理子进程", async () => {
    const entry = createService();
    const rejected = expect(entry.ready()).rejects.toThrow("start timed out");
    await vi.advanceTimersByTimeAsync(60_000);
    await rejected;
    const child = mocks.fork.mock.results.at(-1)!.value as TestChild;
    expect(child.postMessage).toHaveBeenLastCalledWith({ type: "stop" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("其他服务继续使用原来的 15 秒预算", async () => {
    const entry = new OtherService();
    const rejected = expect(entry.ready()).rejects.toThrow("start timed out");
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
