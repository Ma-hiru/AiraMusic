import { MainAgent } from "@mahiru/app/inner/agent";
import type { MainServicesBase } from "@mahiru/app/lib/service";
import type { MainAgentMcpEndpoint } from "@mahiru/app/lib/agent/server";
import type {
  AgentFeatureSettingsConfig,
  AgentFeatureSettingsUpdateInput
} from "@mahiru/ipc/types";

const mocks = vi.hoisted(() => ({
  desired: {} as AgentFeatureSettingsConfig,
  endpoint: undefined as undefined | MainAgentMcpEndpoint,
  applied: undefined as undefined | AgentFeatureSettingsConfig,
  initialize: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
  mcpInit: vi.fn(),
  mcpShutdown: vi.fn(),
  windowGet: vi.fn(),
  windowRemove: vi.fn(),
  windowDestroy: vi.fn(),
  warn: vi.fn()
}));

vi.mock("@mahiru/app/inner/agent/settings", () => ({
  MainAgentSettings: { initialize: mocks.initialize, read: mocks.read, update: mocks.update }
}));
vi.mock("@mahiru/app/inner/agent/mcp", () => ({
  MainAgentMcp: {
    get endpoint() {
      return mocks.endpoint;
    },
    get appliedConfig() {
      return mocks.applied;
    },
    init: mocks.mcpInit,
    shutdown: mocks.mcpShutdown
  }
}));
vi.mock("@mahiru/app/inner/agent/tools", () => {
  const tools = [{ name: "agent-search", description: "搜索歌曲，返回结果。", risk: "read" }];
  return {
    agentToolCatalog: {
      names: tools.map((tool) => tool.name),
      resolve: () => tools
    }
  };
});
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: { get: mocks.windowGet, remove: mocks.windowRemove }
}));
vi.mock("@mahiru/app/lib/log", () => ({ Log: { info: vi.fn(), warn: mocks.warn } }));

const config = (patch: Partial<AgentFeatureSettingsConfig> = {}): AgentFeatureSettingsConfig => ({
  agentEnabled: true,
  mcpEnabled: true,
  mcpPort: 32_123,
  mcpTools: ["agent-search"],
  ...patch
});
const cloneConfig = (value: AgentFeatureSettingsConfig): AgentFeatureSettingsConfig => ({
  ...value,
  mcpTools: [...value.mcpTools]
});
const endpoint = (port: number): MainAgentMcpEndpoint => ({
  host: "127.0.0.1",
  port,
  url: `http://127.0.0.1:${port}/mcp`
});

function createServices() {
  const connection = { endpoint: "http://127.0.0.1:45679", token: "control-token" };
  const service = { running: false, getConnection: vi.fn(() => connection) };
  const startService = vi.fn(async () => {
    service.running = true;
  });
  const stopService = vi.fn(async () => {
    service.running = false;
  });
  const services = { getInstance: vi.fn(() => service), startService, stopService };
  return {
    service,
    connection,
    startService,
    stopService,
    services: services as unknown as MainServicesBase
  };
}

describe("MainAgent 功能协调", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.desired = config();
    mocks.endpoint = undefined;
    mocks.applied = undefined;
    mocks.initialize.mockImplementation(() => cloneConfig(mocks.desired));
    mocks.read.mockImplementation(() => cloneConfig(mocks.desired));
    mocks.update.mockImplementation((input: AgentFeatureSettingsUpdateInput) => {
      mocks.desired = cloneConfig({ ...mocks.desired, ...input });
      return cloneConfig(mocks.desired);
    });
    mocks.mcpInit.mockImplementation(async (snapshot: AgentFeatureSettingsConfig) => {
      mocks.applied = cloneConfig(snapshot);
      mocks.endpoint = endpoint(snapshot.mcpPort);
      return mocks.endpoint;
    });
    mocks.mcpShutdown.mockImplementation(async () => {
      mocks.endpoint = undefined;
      mocks.applied = undefined;
    });
    mocks.windowGet.mockReturnValue({ isDestroyed: () => false, destroy: mocks.windowDestroy });
  });

  it("构造只初始化一次配置，读取状态不写配置、启动服务或广播", () => {
    const onStateChange = vi.fn();
    const agent = new MainAgent({ onStateChange });

    expect(agent.getState()).toMatchObject({
      agentEnabled: true,
      mcpEnabled: true,
      effective: { agentEnabled: false, mcpEnabled: false }
    });
    agent.getState();
    expect(mocks.initialize).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.mcpInit).not.toHaveBeenCalled();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it("只按完整启动快照初始化一次，并等待 MCP 就绪后启动 Agent", async () => {
    const runtime = createServices();
    const opened = Promise.withResolvers<MainAgentMcpEndpoint>();
    mocks.mcpInit.mockImplementation(async (snapshot: AgentFeatureSettingsConfig) => {
      mocks.endpoint = await opened.promise;
      mocks.applied = cloneConfig(snapshot);
      return mocks.endpoint;
    });
    const agent = new MainAgent();
    mocks.desired = config({ mcpPort: 45_678, mcpTools: ["agent-tool-player-action"] });

    const first = agent.init(runtime.services);
    expect(agent.init(runtime.services)).toBe(first);
    expect(mocks.mcpInit).toHaveBeenCalledExactlyOnceWith(config());
    expect(runtime.startService).not.toHaveBeenCalled();

    opened.resolve(endpoint(32_123));
    await first;
    await agent.init(runtime.services);

    expect(runtime.startService).toHaveBeenCalledExactlyOnceWith("agent");
    expect(mocks.mcpInit).toHaveBeenCalledOnce();
    expect(agent.getState()).toMatchObject({
      mcpPort: 45_678,
      mcpTools: ["agent-tool-player-action"],
      effective: {
        agentEnabled: true,
        mcpEnabled: true,
        mcpPort: 32_123,
        mcpTools: ["agent-search"]
      },
      restartRequired: true
    });
  });

  it("内部端点监听不代表公开 MCP 已启用", async () => {
    mocks.desired = config({ mcpEnabled: false });
    const runtime = createServices();
    const agent = new MainAgent();

    await agent.init(runtime.services);

    expect(mocks.endpoint).toBeDefined();
    expect(agent.getState()).toMatchObject({
      effective: { agentEnabled: true, mcpEnabled: false },
      restartRequired: false
    });
  });

  it("运行实例退出后立即反映实际状态并拒绝连接", async () => {
    const runtime = createServices();
    const agent = new MainAgent();
    await agent.init(runtime.services);
    expect(agent.getConnection()).toEqual(runtime.connection);

    runtime.service.running = false;

    expect(agent.running).toBe(false);
    expect(agent.getState()).toMatchObject({
      effective: { agentEnabled: false },
      restartRequired: true
    });
    expect(() => agent.getConnection()).toThrow("本次启动未运行");
    expect(runtime.service.getConnection).toHaveBeenCalledOnce();
  });

  it("关闭 Agent 保留公开 MCP，重新开启只提示重启，两个开关关闭才停止 MCP", async () => {
    const runtime = createServices();
    const agent = new MainAgent();
    await agent.init(runtime.services);

    const disabled = await agent.updateSettings({ agentEnabled: false });
    expect(disabled.effective).toMatchObject({ agentEnabled: false, mcpEnabled: true });
    expect(mocks.windowDestroy).toHaveBeenCalledOnce();
    expect(mocks.windowRemove).toHaveBeenCalledWith("agent");
    expect(mocks.mcpShutdown).not.toHaveBeenCalled();

    const reenabled = await agent.updateSettings({ agentEnabled: true });
    expect(reenabled).toMatchObject({
      agentEnabled: true,
      effective: { agentEnabled: false },
      restartRequired: true
    });
    expect(runtime.startService).toHaveBeenCalledOnce();
    expect(mocks.mcpInit).toHaveBeenCalledOnce();

    const stopped = await agent.updateSettings({ agentEnabled: false, mcpEnabled: false });
    expect(mocks.mcpShutdown).toHaveBeenCalledOnce();
    expect(stopped).toMatchObject({
      effective: { agentEnabled: false, mcpEnabled: false },
      restartRequired: false
    });
  });

  it("停止失败仍广播真实状态，相同关闭配置可重试停止", async () => {
    const runtime = createServices();
    const onStateChange = vi.fn();
    const agent = new MainAgent({ onStateChange });
    await agent.init(runtime.services);
    onStateChange.mockClear();
    runtime.stopService.mockRejectedValueOnce(new Error("stop failed"));

    await expect(agent.updateSettings({ agentEnabled: false })).rejects.toThrow("stop failed");
    expect(onStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        agentEnabled: false,
        effective: expect.objectContaining({ agentEnabled: true })
      })
    );

    const retried = await agent.updateSettings({ agentEnabled: false });
    expect(runtime.stopService).toHaveBeenCalledTimes(2);
    expect(retried.effective.agentEnabled).toBe(false);
    expect(onStateChange).toHaveBeenCalledTimes(2);
    expect(onStateChange).toHaveBeenLastCalledWith(retried);
    expect(runtime.startService).toHaveBeenCalledOnce();
  });

  it("并发设置更新会等待前一次停止完成，再持久化和应用下一次设置", async () => {
    const runtime = createServices();
    const agent = new MainAgent();
    await agent.init(runtime.services);
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    runtime.stopService.mockImplementationOnce(async () => {
      entered.resolve();
      await released.promise;
      runtime.service.running = false;
    });

    const first = agent.updateSettings({ agentEnabled: false });
    const second = agent.updateSettings({ mcpEnabled: false });
    await entered.promise;
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ agentEnabled: false });
    expect(mocks.desired.mcpEnabled).toBe(true);

    released.resolve();
    await first;
    const final = await second;
    expect(mocks.update).toHaveBeenNthCalledWith(2, { mcpEnabled: false });
    expect(mocks.mcpShutdown).toHaveBeenCalledOnce();
    expect(final.effective).toMatchObject({ agentEnabled: false, mcpEnabled: false });
  });

  it("初始化中关闭会等待 MCP 收尾，且不会继续启动 Agent", async () => {
    const runtime = createServices();
    const opened = Promise.withResolvers<MainAgentMcpEndpoint>();
    mocks.mcpInit.mockImplementation(async (snapshot: AgentFeatureSettingsConfig) => {
      mocks.endpoint = await opened.promise;
      mocks.applied = cloneConfig(snapshot);
      return mocks.endpoint;
    });
    const agent = new MainAgent();

    const starting = agent.init(runtime.services);
    const stopping = agent.shutdown();
    expect(agent.shutdown()).toBe(stopping);
    opened.resolve(endpoint(32_123));
    await Promise.all([starting, stopping]);

    expect(runtime.startService).not.toHaveBeenCalled();
    expect(mocks.mcpShutdown).toHaveBeenCalledOnce();
    expect(agent.getState().effective).toMatchObject({ agentEnabled: false, mcpEnabled: false });
  });

  it("关闭失败仍清理 MCP，后续关闭可重试且不会再次启动", async () => {
    const runtime = createServices();
    const agent = new MainAgent();
    await agent.init(runtime.services);
    runtime.stopService.mockRejectedValueOnce(new Error("stop failed"));

    const first = agent.shutdown();
    expect(agent.shutdown()).toBe(first);
    await expect(first).rejects.toThrow("stop failed");
    expect(mocks.mcpShutdown).toHaveBeenCalledOnce();

    await agent.shutdown();
    await agent.init(runtime.services);
    expect(runtime.stopService).toHaveBeenCalledTimes(2);
    expect(runtime.startService).toHaveBeenCalledOnce();
    expect(agent.running).toBe(false);
  });

  it("启动配置关闭时不启动服务，随后开启配置也不会懒启动", async () => {
    mocks.desired = config({ agentEnabled: false, mcpEnabled: false });
    const runtime = createServices();
    const agent = new MainAgent();
    await agent.init(runtime.services);

    const updated = await agent.updateSettings({ agentEnabled: true, mcpEnabled: true });

    expect(mocks.mcpInit).not.toHaveBeenCalled();
    expect(runtime.startService).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      effective: { agentEnabled: false, mcpEnabled: false },
      restartRequired: true
    });
  });
});
