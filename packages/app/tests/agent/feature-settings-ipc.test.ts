import type { AgentFeatureSettingsState } from "@mahiru/ipc/types";

const {
  frame,
  sender,
  shutdown,
  commitAll,
  initialize,
  agentWindow,
  getSettings,
  getWindowID,
  shutdownMcp,
  removeWindow,
  updateSettings,
  fromWebContents,
  broadcastFeatureSettings
} = vi.hoisted(() => {
  const frame = { url: "http://localhost:5173/" };
  const sender = { mainFrame: frame };
  const mainWindow = {};
  return {
    frame,
    sender,
    shutdown: vi.fn(),
    shutdownMcp: vi.fn(),
    initialize: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    removeWindow: vi.fn(),
    commitAll: vi.fn(),
    broadcastFeatureSettings: vi.fn(),
    fromWebContents: vi.fn(() => mainWindow),
    getWindowID: vi.fn(() => "main"),
    agentWindow: { destroy: vi.fn(), isDestroyed: vi.fn(() => false) }
  };
});

vi.mock("electron", () => ({
  app: {},
  dialog: {},
  BrowserWindow: { fromWebContents }
}));
vi.mock("@mahiru/ipc/main", () => ({
  MainIPC: { MessageChannel: { commitAll } }
}));
vi.mock("@mahiru/app/lib/log", () => ({
  Log: { error: vi.fn(), warn: vi.fn() }
}));
vi.mock("@mahiru/app/services/agent", () => ({
  MainAgent: {
    init: initialize,
    shutdown,
    broadcastFeatureSettings
  }
}));
vi.mock("@mahiru/app/inner/mcp/runtime", () => ({
  MainMcp: { shutdown: shutdownMcp }
}));
vi.mock("@mahiru/app/services/agent/settings", () => ({
  MainAgentFeatureSettings: { getState: getSettings, update: updateSettings }
}));
vi.mock("@mahiru/app/lib/handle", () => ({ MainHandle: {} }));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: {} }));
vi.mock("@mahiru/app/utils/merge", () => ({ mergeCacheStoreConfig: vi.fn() }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: {
    getId: getWindowID,
    remove: removeWindow,
    get: vi.fn((type: string) => (type === "agent" ? agentWindow : null)),
    getAppFrameURL: vi.fn(() => "http://localhost:5173/")
  }
}));
vi.mock("@mahiru/app/lib/screen-resolver", () => ({ MainScreenResolver: {} }));
vi.mock("@mahiru/app/constants/store", () => ({ MainCacheStoreConstants: {} }));
vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForConfig: {},
  MainStoreForRenderer: {}
}));

const availableMcpTools = [
  { name: "agent-search", label: "搜索音乐", description: "搜索音乐资源", risk: "read" as const }
];

function createState(
  agentEnabled: boolean,
  effectiveAgentEnabled: boolean,
  restartRequired: boolean
): AgentFeatureSettingsState {
  return {
    agentEnabled,
    mcpEnabled: false,
    mcpPort: 32_123,
    mcpTools: ["agent-search"],
    availableMcpTools,
    restartRequired,
    effective: {
      agentEnabled: effectiveAgentEnabled,
      mcpEnabled: false,
      mcpPort: 32_123,
      mcpTools: ["agent-search"]
    }
  };
}

describe("Agent 功能设置 IPC 生命周期", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("关闭 Agent 时立即停止运行、销毁窗口并广播最终状态", async () => {
    const enabled = createState(true, true, false);
    const disabled = createState(false, false, false);
    getSettings.mockReturnValueOnce(enabled).mockReturnValue(disabled);
    updateSettings.mockReturnValue(disabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: false }
    );

    expect(shutdown).toHaveBeenCalledOnce();
    expect(shutdownMcp).toHaveBeenCalledOnce();
    expect(agentWindow.destroy).toHaveBeenCalledOnce();
    expect(removeWindow).toHaveBeenCalledWith("agent");
    expect(broadcastFeatureSettings).toHaveBeenCalledWith(disabled);
    expect(result).toEqual({ ok: true, data: disabled });
  });

  it("关闭 Agent 但保留公共 MCP 时不停止共享 MCP", async () => {
    const enabled = createState(true, true, false);
    enabled.mcpEnabled = true;
    enabled.effective.mcpEnabled = true;
    const disabled = createState(false, false, false);
    disabled.mcpEnabled = true;
    disabled.effective.mcpEnabled = true;
    getSettings.mockReturnValueOnce(enabled).mockReturnValue(disabled);
    updateSettings.mockReturnValue(disabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: false }
    );

    expect(shutdown).toHaveBeenCalledOnce();
    expect(shutdownMcp).not.toHaveBeenCalled();
  });

  it("公共 MCP 是唯一消费者时关闭设置会立即停止共享 MCP", async () => {
    const enabled = createState(false, false, false);
    enabled.mcpEnabled = true;
    enabled.effective.mcpEnabled = true;
    const disabled = createState(false, false, false);
    getSettings.mockReturnValueOnce(enabled).mockReturnValue(disabled);
    updateSettings.mockReturnValue(disabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { mcpEnabled: false }
    );

    expect(shutdown).not.toHaveBeenCalled();
    expect(shutdownMcp).toHaveBeenCalledOnce();
  });

  it("本轮重新开启只持久化并提示重启，不会懒初始化", async () => {
    const disabled = createState(false, false, false);
    const reenabled = createState(true, false, true);
    getSettings.mockReturnValueOnce(disabled).mockReturnValue(reenabled);
    updateSettings.mockReturnValue(reenabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: true }
    );

    expect(initialize).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
    expect(agentWindow.destroy).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: reenabled });
  });

  it("拒绝主窗口 iframe 和其他窗口修改功能设置", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: { url: frame.url } } as never,
      { agentEnabled: false }
    );

    expect(result).toMatchObject({ ok: false, reason: { code: "auth" } });
    expect(updateSettings).not.toHaveBeenCalled();
    expect(shutdown).not.toHaveBeenCalled();
  });

  it("由主窗口主框架返回带 effective 和工具清单的完整状态", async () => {
    const enabled = createState(true, true, false);
    getSettings.mockReturnValue(enabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = invokeHandlers.invoke_agent_feature_settings_get(
      { sender, senderFrame: frame } as never,
      undefined
    );

    expect(result).toEqual({ ok: true, data: enabled });
  });

  it("允许 display 设置窗口在其 SPA 子路由下读取功能设置", async () => {
    // 校验会先尝试 main 分支再尝试 display 分支，getId 会被多次调用
    getWindowID.mockReturnValue("display");
    const displayFrame = { url: "http://localhost:5173/display.html/settings" };
    const displaySender = { mainFrame: displayFrame };
    const { MainWindowManager } = await import("@mahiru/app/lib/window-manager");
    vi.mocked(MainWindowManager.getAppFrameURL).mockReturnValueOnce(
      "http://localhost:5173/display.html"
    );

    const enabled = createState(true, true, false);
    getSettings.mockReturnValue(enabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = invokeHandlers.invoke_agent_feature_settings_get(
      { sender: displaySender, senderFrame: displayFrame } as never,
      undefined
    );

    expect(result).toEqual({ ok: true, data: enabled });
  });

  it("拒绝 display 窗口 iframe 和伪造成其他端口页面的功能设置请求", async () => {
    getWindowID.mockReturnValue("display");
    const { MainWindowManager } = await import("@mahiru/app/lib/window-manager");
    vi.mocked(MainWindowManager.getAppFrameURL).mockReturnValue(
      "http://localhost:5173/display.html"
    );

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const iframe = await invokeHandlers.invoke_agent_feature_settings_get(
      {
        sender,
        senderFrame: { url: "http://localhost:5173/display.html/settings" }
      } as never,
      undefined
    );
    expect(iframe).toMatchObject({ ok: false, reason: { code: "auth" } });

    const foreignSender = {
      mainFrame: { url: "http://localhost:9999/display.html/settings" }
    };
    const foreign = invokeHandlers.invoke_agent_feature_settings_get(
      { sender: foreignSender, senderFrame: foreignSender.mainFrame } as never,
      undefined
    );
    expect(foreign).toMatchObject({ ok: false, reason: { code: "auth" } });
    expect(getSettings).not.toHaveBeenCalled();
  });
});
