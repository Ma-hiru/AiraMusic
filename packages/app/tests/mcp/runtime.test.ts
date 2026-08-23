import { it, vi, expect, describe, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  markFailed: vi.fn(),
  markInitialized: vi.fn(),
  markStopped: vi.fn(),
  serverConfigs: [] as unknown[],
  start: vi.fn(),
  stop: vi.fn()
}));

vi.mock("../../src/lib/runtime", () => ({
  MainRuntime: { agentMcpToken: "internal-mcp-token" }
}));

vi.mock("../../src/inner/mcp/public-tools", () => ({
  AiraPublicMcpToolNames: ["agent-search", "agent-tool-player-action"]
}));

vi.mock("../../src/services/agent/settings", () => ({
  MainAgentFeatureSettings: {
    beginMcpInitialization: mocks.begin,
    markMcpInitialized: mocks.markInitialized,
    markMcpInitializationFailed: mocks.markFailed,
    markMcpStopped: mocks.markStopped
  }
}));

vi.mock("../../src/inner/mcp/server", () => ({
  AiraMcpServer: class {
    endpoint = undefined;

    constructor(config: unknown) {
      mocks.serverConfigs.push(config);
    }

    start() {
      return mocks.start();
    }

    stop() {
      return mocks.stop();
    }
  }
}));

describe("MainMcp", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.begin.mockReset();
    mocks.markFailed.mockReset();
    mocks.markInitialized.mockReset();
    mocks.markStopped.mockReset();
    mocks.start.mockReset();
    mocks.stop.mockReset().mockResolvedValue(undefined);
    mocks.serverConfigs.length = 0;
  });

  it("只使用启动快照并在真正监听后更新 effective", async () => {
    mocks.begin.mockReturnValue({
      agentEnabled: true,
      mcpEnabled: true,
      mcpPort: 32_123,
      mcpTools: ["agent-search"]
    });
    mocks.start.mockResolvedValue({
      host: "127.0.0.1",
      port: 32_123,
      url: "http://127.0.0.1:32123/mcp"
    });

    const { MainMcp } = await import("../../src/inner/mcp/runtime");
    await expect(MainMcp.init()).resolves.toMatchObject({ port: 32_123 });

    expect(mocks.serverConfigs).toEqual([
      {
        port: 32_123,
        toolNames: ["agent-search"],
        internalToken: "internal-mcp-token",
        internalToolNames: ["agent-search", "agent-tool-player-action"]
      }
    ]);
    expect(mocks.markInitialized).toHaveBeenCalledWith(32_123, ["agent-search"]);

    await MainMcp.shutdown();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.markStopped).toHaveBeenCalledOnce();
  });

  it("未启用时不创建服务器", async () => {
    mocks.begin.mockReturnValue(undefined);
    const { MainMcp } = await import("../../src/inner/mcp/runtime");

    await expect(MainMcp.init()).resolves.toBeUndefined();
    expect(mocks.serverConfigs).toHaveLength(0);
  });

  it("仅启用 Agent 时创建内部端点且不公开任何工具", async () => {
    mocks.begin.mockReturnValue({
      agentEnabled: true,
      mcpEnabled: false,
      mcpPort: 32_123,
      mcpTools: ["agent-search"]
    });
    mocks.start.mockResolvedValue({
      host: "127.0.0.1",
      port: 32_123,
      url: "http://127.0.0.1:32123/mcp"
    });
    const { MainMcp } = await import("../../src/inner/mcp/runtime");

    await expect(MainMcp.init()).resolves.toMatchObject({ port: 32_123 });
    expect(mocks.serverConfigs).toEqual([
      {
        port: 32_123,
        toolNames: [],
        internalToken: "internal-mcp-token",
        internalToolNames: ["agent-search", "agent-tool-player-action"]
      }
    ]);
    expect(mocks.markInitialized).not.toHaveBeenCalled();
    await MainMcp.shutdown();
  });

  it("启动失败时回收实例并回滚 effective", async () => {
    mocks.begin.mockReturnValue({
      agentEnabled: true,
      mcpEnabled: true,
      mcpPort: 32_123,
      mcpTools: ["agent-search"]
    });
    mocks.start.mockRejectedValue(new Error("EADDRINUSE"));
    const { MainMcp } = await import("../../src/inner/mcp/runtime");

    await expect(MainMcp.init()).rejects.toThrow("EADDRINUSE");
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.markFailed).toHaveBeenCalledOnce();
  });
});
