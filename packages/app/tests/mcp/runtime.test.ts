import { it, vi, expect, describe, afterEach, beforeEach } from "vitest";
import type { AgentFeatureSettingsConfig } from "@mahiru/ipc/types";

import type { MainAgentMcpEndpoint, MainAgentMcpServerOptions } from "../../src/lib/agent/server";

const mocks = vi.hoisted(() => ({
  serverConfigs: [] as MainAgentMcpServerOptions[],
  start: vi.fn(),
  stop: vi.fn(),
  beforeCall: vi.fn(),
  formatResult: vi.fn(),
  formatError: vi.fn()
}));

vi.mock("../../src/lib/runtime", () => ({
  MainRuntime: { agentMcpToken: "internal-mcp-token" }
}));

vi.mock("../../src/inner/agent/tools", () => {
  const list = [{ name: "agent-search" }, { name: "agent-tool-player-action" }];
  return {
    agentToolCatalog: {
      list,
      resolve: (names: string[]) => list.filter((tool) => names.includes(tool.name))
    }
  };
});

vi.mock("../../src/lib/window-manager", () => ({ MainWindowManager: { get: () => null } }));
vi.mock("../../src/lib/agent/tool", () => ({
  MainAgentTool: {
    beforeCall: mocks.beforeCall,
    formatResult: mocks.formatResult,
    formatError: mocks.formatError
  }
}));

vi.mock("../../src/lib/agent/server", () => ({
  MainAgentMcpServer: class {
    endpoint?: MainAgentMcpEndpoint;

    constructor(config: MainAgentMcpServerOptions) {
      mocks.serverConfigs.push(config);
    }

    async start() {
      const endpoint: MainAgentMcpEndpoint = await mocks.start();
      this.endpoint = endpoint;
      return endpoint;
    }

    async stop() {
      await mocks.stop();
      this.endpoint = undefined;
    }
  }
}));

const endpoint: MainAgentMcpEndpoint = {
  host: "127.0.0.1",
  port: 32_123,
  url: "http://127.0.0.1:32123/mcp"
};
const config = (update: Partial<AgentFeatureSettingsConfig> = {}): AgentFeatureSettingsConfig => ({
  agentEnabled: true,
  mcpEnabled: true,
  mcpPort: 32_123,
  mcpTools: ["agent-search"],
  ...update
});

describe("MainAgentMcp", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    mocks.start.mockResolvedValue(endpoint);
    mocks.stop.mockResolvedValue(undefined);
    mocks.serverConfigs.length = 0;
  });

  afterEach(async () => {
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    await MainAgentMcp.shutdown();
  });

  it("按传入快照组装目录和钩子，监听成功后才提供已应用配置", async () => {
    const started = Promise.withResolvers<MainAgentMcpEndpoint>();
    mocks.start.mockReturnValue(started.promise);
    const snapshot = config();
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    const starting = MainAgentMcp.init(snapshot);
    expect(MainAgentMcp.endpoint).toBeUndefined();
    expect(MainAgentMcp.appliedConfig).toBeUndefined();

    snapshot.mcpPort = 45_678;
    snapshot.mcpTools.push("agent-tool-player-action");
    started.resolve(endpoint);
    await expect(starting).resolves.toEqual(endpoint);
    expect(MainAgentMcp.appliedConfig).toEqual(config());
    expect(mocks.serverConfigs).toHaveLength(1);

    const options = mocks.serverConfigs[0]!;
    expect(options.port).toBe(32_123);
    expect(options.tools.map((tool) => tool.name)).toEqual(["agent-search"]);
    const scope = (token?: string) =>
      options.resolveScope!(
        new Request("http://127.0.0.1/mcp", {
          headers: token ? { authorization: "Bearer " + token } : {}
        })
      );
    expect(scope().access).toBe("public");
    expect(scope("wrong-token").tools.map((tool) => tool.name)).toEqual(["agent-search"]);
    expect(scope("internal-mcp-token").access).toBe("internal");
    expect(scope("internal-mcp-token").tools.map((tool) => tool.name)).toEqual([
      "agent-search",
      "agent-tool-player-action"
    ]);

    const tool = options.tools[0]!;
    const context = { conversationID: "mcp", outputDetail: "standard" as const };
    options.beforeCall!(tool, context);
    expect(mocks.beforeCall).toHaveBeenCalledWith(tool, context, expect.any(Function));
    expect(mocks.beforeCall.mock.calls[0]![2]()).toBe(false);
    options.mapResult!({ answer: "ok" }, tool, context);
    expect(mocks.formatResult).toHaveBeenCalledWith({ answer: "ok" }, tool, context);
    const error = new Error("failed");
    options.mapError!(error, tool);
    expect(mocks.formatError).toHaveBeenCalledWith(error, tool);

    MainAgentMcp.appliedConfig!.mcpTools.push("mutated-copy");
    expect(MainAgentMcp.appliedConfig!.mcpTools).toEqual(["agent-search"]);
    await MainAgentMcp.shutdown();
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(MainAgentMcp.appliedConfig).toBeUndefined();
    expect(MainAgentMcp.endpoint).toBeUndefined();
  });

  it("两个开关均关闭时不创建服务器", async () => {
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");

    await expect(
      MainAgentMcp.init(config({ agentEnabled: false, mcpEnabled: false }))
    ).resolves.toBeUndefined();
    expect(mocks.serverConfigs).toHaveLength(0);
    expect(MainAgentMcp.appliedConfig).toBeUndefined();
  });

  it("仅启用 Agent 时仍提供内部端点，公开目录为空", async () => {
    const snapshot = config({ mcpEnabled: false });
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");

    await expect(MainAgentMcp.init(snapshot)).resolves.toEqual(endpoint);
    expect(mocks.serverConfigs).toHaveLength(1);
    expect(mocks.serverConfigs[0]!.tools).toEqual([]);
    expect(MainAgentMcp.appliedConfig).toEqual(snapshot);
    const internalScope = mocks.serverConfigs[0]!.resolveScope!(
      new Request("http://127.0.0.1/mcp", {
        headers: { authorization: "Bearer internal-mcp-token" }
      })
    );
    expect(internalScope.access).toBe("internal");
    expect(internalScope.tools.map((tool) => tool.name)).toEqual([
      "agent-search",
      "agent-tool-player-action"
    ]);
  });

  it("并发初始化共用一次启动，运行中传入新配置不会偷偷重启", async () => {
    const started = Promise.withResolvers<MainAgentMcpEndpoint>();
    mocks.start.mockReturnValue(started.promise);
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    const first = MainAgentMcp.init(config());
    expect(MainAgentMcp.init(config())).toBe(first);
    started.resolve(endpoint);
    await first;

    await expect(MainAgentMcp.init(config({ mcpPort: 45_678 }))).resolves.toEqual(endpoint);
    expect(mocks.serverConfigs).toHaveLength(1);
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(MainAgentMcp.appliedConfig!.mcpPort).toBe(32_123);
  });

  it("启动失败回收实例且不会发布已应用配置，之后允许重试", async () => {
    mocks.start.mockRejectedValueOnce(new Error("EADDRINUSE"));
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");

    await expect(MainAgentMcp.init(config())).rejects.toThrow("EADDRINUSE");
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(MainAgentMcp.appliedConfig).toBeUndefined();
    expect(MainAgentMcp.endpoint).toBeUndefined();

    await expect(MainAgentMcp.init(config())).resolves.toEqual(endpoint);
    expect(mocks.serverConfigs).toHaveLength(2);
  });

  it("启动中关闭会等待启动完成，并发关闭只释放一次实例", async () => {
    const started = Promise.withResolvers<MainAgentMcpEndpoint>();
    mocks.start.mockReturnValue(started.promise);
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    const starting = MainAgentMcp.init(config());
    const stopping = MainAgentMcp.shutdown();
    expect(MainAgentMcp.shutdown()).toBe(stopping);
    expect(mocks.stop).not.toHaveBeenCalled();

    started.resolve(endpoint);
    await starting;
    await stopping;
    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(MainAgentMcp.endpoint).toBeUndefined();
    expect(MainAgentMcp.appliedConfig).toBeUndefined();
  });

  it("关闭过程中重新初始化会等待旧实例释放，再创建一份新实例", async () => {
    const stopped = Promise.withResolvers<void>();
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    await MainAgentMcp.init(config());
    mocks.stop.mockReturnValueOnce(stopped.promise);
    const stopping = MainAgentMcp.shutdown();
    const next = config({ mcpTools: ["agent-tool-player-action"] });
    const restarting = MainAgentMcp.init(next);
    const anotherRestart = MainAgentMcp.init(next);
    next.mcpTools.length = 0;
    expect(mocks.serverConfigs).toHaveLength(1);

    stopped.resolve();
    await stopping;
    await expect(restarting).resolves.toEqual(endpoint);
    await expect(anotherRestart).resolves.toEqual(endpoint);
    expect(mocks.serverConfigs).toHaveLength(2);
    expect(MainAgentMcp.appliedConfig!.mcpTools).toEqual(["agent-tool-player-action"]);
    expect(mocks.serverConfigs[1]!.tools.map((tool) => tool.name)).toEqual([
      "agent-tool-player-action"
    ]);
  });

  it("关闭失败仍可重试清理", async () => {
    const { MainAgentMcp } = await import("../../src/inner/agent/mcp");
    await MainAgentMcp.init(config());
    mocks.stop.mockRejectedValueOnce(new Error("close failed"));

    await expect(MainAgentMcp.shutdown()).rejects.toThrow("close failed");
    expect(MainAgentMcp.appliedConfig).toMatchObject({ mcpEnabled: true });
    expect(MainAgentMcp.endpoint).toEqual(endpoint);
    await expect(MainAgentMcp.shutdown()).resolves.toBeUndefined();
    expect(mocks.stop).toHaveBeenCalledTimes(2);
    expect(MainAgentMcp.endpoint).toBeUndefined();
    expect(MainAgentMcp.appliedConfig).toBeUndefined();
  });
});
