import { it, vi, expect, describe, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  stop: vi.fn(),
  getSecret: vi.fn(() => "persisted-store-secret")
}));

vi.mock("@mahiru/agent", () => ({
  Agent: { run: mocks.run }
}));

vi.mock("../../src/lib/runtime", () => ({
  MainRuntime: {
    agentControlToken: "control-token",
    agentMcpToken: "mcp-token"
  }
}));

vi.mock("../../src/lib/path-resolver", () => ({
  MainPathResolver: {
    agentBinaryPath: "C:/app/bin/agent.exe",
    agentDataDir: "C:/data/agent"
  }
}));

vi.mock("../../src/services/agent/secret", () => ({
  getAgentStoreSecret: mocks.getSecret
}));

vi.mock("../../src/lib/log", () => ({
  Log: {
    EnvLevel: 1,
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import { RustAgentService } from "../../src/services/agent/child";

describe("Rust Agent 主进程服务", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stop.mockResolvedValue(true);
  });

  it("只通过环境选项传递凭证并原样转发 AG-UI 事件", async () => {
    const event = { type: "RUN_STARTED", threadId: "thread-1", runId: "run-1" } as const;
    mocks.run.mockResolvedValue({
      running: true,
      events: async function* () {
        yield event;
      },
      stop: mocks.stop
    });
    const service = new RustAgentService();
    const received: unknown[] = [];
    service.listen((value) => received.push(value));

    await service.start("http://127.0.0.1:32123/mcp");
    await vi.waitFor(() => expect(received).toEqual([event]));

    expect(mocks.run).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 0,
        mcpUrl: "http://127.0.0.1:32123/mcp",
        execPath: "C:/app/bin/agent.exe",
        dataDir: "C:/data/agent",
        controlToken: "control-token",
        mcpToken: "mcp-token",
        storeSecret: "persisted-store-secret",
        logLevel: "DEBUG"
      })
    );
    await expect(service.stop()).resolves.toBe(true);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("拒绝重复启动同一服务实例", async () => {
    mocks.run.mockResolvedValue({
      running: true,
      events: async function* () {},
      stop: mocks.stop
    });
    const service = new RustAgentService();
    await service.start("http://127.0.0.1:32123/mcp");
    await expect(service.start("http://127.0.0.1:32123/mcp")).rejects.toThrow("已经启动");
    await service.stop();
  });

  it("AG-UI 事件流意外断开后自动重连", async () => {
    const event = { type: "RUN_STARTED", threadId: "thread-1", runId: "run-1" } as const;
    let attempts = 0;
    mocks.run.mockResolvedValue({
      running: true,
      events: async function* () {
        attempts += 1;
        if (attempts === 1) throw new Error("connection reset");
        yield event;
      },
      stop: mocks.stop
    });
    const service = new RustAgentService();
    const received: unknown[] = [];
    service.listen((value) => received.push(value));

    await service.start("http://127.0.0.1:32123/mcp");
    await vi.waitFor(() => expect(received).toEqual([event]), { timeout: 2_000 });
    expect(attempts).toBeGreaterThanOrEqual(2);

    await service.stop();
  });

  it("按 Rust 日志等级写入 Electron Log", async () => {
    mocks.run.mockResolvedValue({
      running: true,
      events: async function* () {},
      stop: mocks.stop
    });
    const service = new RustAgentService();
    await service.start("http://127.0.0.1:32123/mcp");

    const options = mocks.run.mock.calls[0]?.[0];
    options.logger({
      level: "INFO",
      message: "mcp connected",
      target: "agent::mcp",
      fields: { server: "aira-music" }
    });

    const { Log } = await import("../../src/lib/log");
    expect(Log.info).toHaveBeenCalledWith("agent:agent::mcp", "mcp connected server=aira-music");
    await service.stop();
  });
});
