import { it, vi, expect, describe, beforeEach } from "vitest";
import { LogLevel } from "@mahiru/log";

const mocks = vi.hoisted(() => ({ run: vi.fn(), stop: vi.fn() }));
vi.mock("@mahiru/agent", () => ({ Agent: { run: mocks.run } }));
vi.mock("../../src/lib/log", () => ({
  Log: {
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    JsonCompact: (record: object) => record,
    JsonFlat: (record: object) => record
  }
}));

import AgentService from "../../src/services/agent";

const options = {
  port: 0,
  execPath: "/app/agent",
  dataDir: "/data/agent",
  mcpUrl: "http://127.0.0.1:32123/mcp",
  controlToken: "control-token",
  mcpToken: "mcp-token",
  storeSecret: "store-secret",
  logLevel: LogLevel.INFO,
  onPanicError: vi.fn(),
  logger: vi.fn()
};
const instance = () => {
  const exited = Promise.withResolvers<void>();
  return {
    running: true,
    endpoint: "http://127.0.0.1:34567",
    stop: mocks.stop,
    closed: exited.promise,
    exit() {
      this.running = false;
      exited.resolve();
    }
  };
};

describe("MainServices Agent 服务", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stop.mockResolvedValue(true);
    mocks.run.mockResolvedValue(instance());
  });

  it("ready 后提供连接配置，并共用一次停止操作", async () => {
    const service = new AgentService(options);
    expect(service.name).toBe("agent");
    expect(service.running).toBe(false);
    expect(() => service.getConnection()).toThrow("未运行");
    await service.ready();
    expect(service.running).toBe(true);
    expect(mocks.run).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        ...options,
        logLevel: "INFO",
        logger: expect.any(Function)
      })
    );
    expect(service.getConnection()).toEqual({
      endpoint: "http://127.0.0.1:34567",
      token: "control-token"
    });
    const stop = service.stop();
    expect(service.stop()).toBe(stop);
    expect(service.running).toBe(false);
    expect(() => service.getConnection()).toThrow("未运行");
    await stop;
    expect(service.running).toBe(false);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("启动中关闭仍等待子进程就绪后释放它", async () => {
    const deferred = Promise.withResolvers<ReturnType<typeof instance>>();
    mocks.run.mockReturnValue(deferred.promise);
    const service = new AgentService(options);
    const stopping = service.stop();
    expect(service.running).toBe(false);
    expect(mocks.stop).not.toHaveBeenCalled();
    deferred.resolve(instance());
    await stopping;
    expect(service.running).toBe(false);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("启动失败传递给 ready，清理不再次报错", async () => {
    mocks.run.mockRejectedValue(new Error("spawn failed"));
    const service = new AgentService(options);
    await expect(service.ready()).rejects.toThrow("spawn failed");
    expect(service.running).toBe(false);
    await expect(service.stop()).resolves.toBeUndefined();
    expect(mocks.stop).not.toHaveBeenCalled();
  });

  it("底层进程意外退出后即时反映运行状态并通过 panic 通知应用", async () => {
    const process = instance();
    mocks.run.mockResolvedValue(process);
    const service = new AgentService(options);
    await service.ready();

    process.exit();
    expect(service.running).toBe(false);
    expect(() => service.getConnection()).toThrow("未运行");
    await process.closed;
    expect(options.onPanicError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: "Agent 服务已退出" })
    );
  });

  it("主动停止导致的进程退出不会报告 panic", async () => {
    const process = instance();
    mocks.run.mockResolvedValue(process);
    mocks.stop.mockImplementationOnce(async () => {
      process.exit();
      return true;
    });
    const service = new AgentService(options);
    await service.ready();

    await service.stop();
    expect(service.running).toBe(false);
    expect(options.onPanicError).not.toHaveBeenCalled();
  });

  it("停止失败会恢复真实运行状态并允许后续重试", async () => {
    const process = instance();
    mocks.run.mockResolvedValue(process);
    mocks.stop.mockRejectedValueOnce(new Error("stop failed"));
    const service = new AgentService(options);
    await service.ready();

    const stopping = service.stop();
    expect(service.stop()).toBe(stopping);
    expect(service.running).toBe(false);
    await expect(stopping).rejects.toThrow("stop failed");
    expect(service.running).toBe(true);
    expect(service.getConnection()).toMatchObject({ endpoint: process.endpoint });

    mocks.stop.mockImplementationOnce(async () => {
      process.exit();
      return true;
    });
    await expect(service.stop()).resolves.toBeUndefined();
    expect(mocks.stop).toHaveBeenCalledTimes(2);
    expect(service.running).toBe(false);
    expect(options.onPanicError).not.toHaveBeenCalled();
  });

  it("底层停止未确认退出时允许重试", async () => {
    const process = instance();
    mocks.run.mockResolvedValue(process);
    mocks.stop.mockResolvedValueOnce(false);
    const service = new AgentService(options);
    await service.ready();

    await expect(service.stop()).rejects.toThrow("尚未退出");
    expect(service.running).toBe(true);
    mocks.stop.mockImplementationOnce(async () => {
      process.exit();
      return true;
    });
    await service.stop();
    expect(service.running).toBe(false);
    expect(mocks.stop).toHaveBeenCalledTimes(2);
  });

  it("按 Rust 日志记录转发到服务 logger", async () => {
    new AgentService(options);
    const logger = mocks.run.mock.calls[0]![0].logger;
    logger({
      level: "INFO",
      message: "mcp connected",
      target: "agent::mcp",
      fields: { server: "aira-music" }
    });
    expect(options.logger).toHaveBeenCalledWith("debug", "agent::mcp", "mcp connected", {
      server: "aira-music"
    });
  });
});
