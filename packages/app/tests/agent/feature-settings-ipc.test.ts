import type { AgentFeatureSettingsState } from "@mahiru/ipc/types";

const {
  frame,
  sender,
  initialize,
  getSettings,
  getWindowID,
  getAppFrameURL,
  updateSettings,
  fromWebContents
} = vi.hoisted(() => {
  const frame = { url: "http://localhost:5173/" };
  const sender = { mainFrame: frame };
  const mainWindow = {};
  return {
    frame,
    sender,
    initialize: vi.fn(),
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    fromWebContents: vi.fn(() => mainWindow),
    getWindowID: vi.fn(() => "main"),
    getAppFrameURL: vi.fn(() => "http://localhost:5173/")
  };
});

vi.mock("electron", () => ({
  app: {},
  dialog: {},
  BrowserWindow: { fromWebContents }
}));
vi.mock("@mahiru/app/lib/log", () => ({
  Log: { error: vi.fn(), warn: vi.fn() },
  runWithLogContext: <T>(_context: unknown, callback: () => T): T => callback()
}));
vi.mock("@mahiru/app/lib/handle", () => ({
  MainHandle: {
    get: () => ({ agent: { getState: getSettings, updateSettings, init: initialize } })
  }
}));
vi.mock("@mahiru/app/lib/runtime", () => ({ MainRuntime: {} }));
vi.mock("@mahiru/app/utils/merge", () => ({ mergeCacheStoreConfig: vi.fn() }));
vi.mock("@mahiru/app/lib/window-manager", () => ({
  MainWindowManager: {
    getId: getWindowID,
    getAppFrameURL
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

describe("Agent 功能设置 IPC 门面", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWindowID.mockReturnValue("main");
    getAppFrameURL.mockReturnValue("http://localhost:5173/");
  });

  it("把设置更新交给应用 Agent，并返回其完成后的最终状态", async () => {
    const disabled = createState(false, false, false);
    const input = { agentEnabled: false };
    updateSettings.mockResolvedValue(disabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      input
    );

    expect(updateSettings).toHaveBeenCalledExactlyOnceWith(input);
    expect(getSettings).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, data: disabled });
  });

  it("等待应用 Agent 完成异步更新再返回状态", async () => {
    const pending = Promise.withResolvers<AgentFeatureSettingsState>();
    updateSettings.mockReturnValue(pending.promise);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: false }
    );

    const disabled = createState(false, false, false);
    expect(updateSettings).toHaveBeenCalledOnce();
    pending.resolve(disabled);
    await expect(result).resolves.toEqual({ ok: true, data: disabled });
  });

  it("转发本轮重新开启请求，不会在 IPC 中懒初始化", async () => {
    const reenabled = createState(true, false, true);
    updateSettings.mockResolvedValue(reenabled);

    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const result = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: true }
    );

    expect(initialize).not.toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledExactlyOnceWith({ agentEnabled: true });
    expect(result).toEqual({ ok: true, data: reenabled });
  });

  it("拒绝 iframe、其他窗口和其他 origin 修改功能设置", async () => {
    const { invokeHandlers } = await import("@mahiru/app/inner/ipc/invoke");
    const iframe = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: { url: frame.url } } as never,
      { agentEnabled: false }
    );

    expect(iframe).toMatchObject({ ok: false, reason: { code: "auth" } });
    getWindowID.mockReturnValue("agent");
    const otherWindow = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender, senderFrame: frame } as never,
      { agentEnabled: false }
    );
    expect(otherWindow).toMatchObject({ ok: false, reason: { code: "auth" } });
    getWindowID.mockReturnValue("main");
    const foreignFrame = { url: "http://localhost:9999/" };
    const foreign = await invokeHandlers.invoke_agent_feature_settings_update(
      { sender: { mainFrame: foreignFrame }, senderFrame: foreignFrame } as never,
      { agentEnabled: false }
    );
    expect(foreign).toMatchObject({ ok: false, reason: { code: "auth" } });
    expect(updateSettings).not.toHaveBeenCalled();
    expect(initialize).not.toHaveBeenCalled();
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
