const { configGet, configSet, configValues } = vi.hoisted(() => {
  const configValues = new Map<string, unknown>();
  return {
    configValues,
    configGet: vi.fn((key: string) => configValues.get(key)),
    configSet: vi.fn((key: string | Record<string, unknown>, value?: unknown) => {
      if (typeof key === "string") {
        configValues.set(key, value);
        return;
      }
      for (const [name, next] of Object.entries(key)) configValues.set(name, next);
    })
  };
});

vi.mock("@mahiru/app/lib/key-value-store", () => ({
  MainStoreForConfig: { get: configGet, set: configSet }
}));
vi.mock("@mahiru/app/inner/mcp/public-tools", () => ({
  AiraPublicMcpToolNames: [
    "agent-search",
    "agent-tool-track-detail",
    "agent-tool-player-action",
    "agent-tool-comment-send"
  ],
  AiraDefaultMcpToolNames: ["agent-search", "agent-tool-track-detail"],
  isAiraMcpMutatingToolName: (name: string) =>
    name === "agent-tool-player-action" || name === "agent-tool-comment-send",
  isAiraMcpDestructiveToolName: (name: string) => name === "agent-tool-comment-send"
}));
vi.mock("@mahiru/app/inner/mcp/tools/catalog", () => ({
  createAgentToolCatalog: vi.fn(() => ({
    list: [
      { name: "agent-search", description: "搜索歌曲、专辑和艺人。" },
      { name: "agent-tool-track-detail", description: "获取指定歌曲的详细信息，支持批量查询。" },
      { name: "agent-tool-player-action", description: "控制播放器播放状态。" },
      { name: "agent-tool-comment-send", description: "发送或回复评论。" },
      { name: "agent-tool-private", description: "不应公开。" }
    ],
    parallelSafeNames: ["agent-search", "agent-tool-track-detail"]
  }))
}));

describe("Agent 功能设置启动快照", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    configValues.clear();
  });

  it("迁移旧开关，并在 Agent 真正初始化后更新 effective", async () => {
    configValues.set("enableAgent", true);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");

    const captured = MainAgentFeatureSettings.captureStartup();
    expect(captured).toMatchObject({
      agentEnabled: true,
      effective: { agentEnabled: false, mcpEnabled: false },
      restartRequired: true
    });
    expect(configSet).toHaveBeenCalledWith("agentEnabled", true);
    expect(MainAgentFeatureSettings.beginAgentInitialization()).toBe(true);

    const initialized = MainAgentFeatureSettings.markAgentInitialized();
    expect(initialized.effective.agentEnabled).toBe(true);
    expect(initialized.restartRequired).toBe(false);
  });

  it("设置更新只改期望值，不覆盖本次启动的 MCP 快照", async () => {
    configValues.set("agentEnabled", false);
    configValues.set("mcpEnabled", false);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");
    MainAgentFeatureSettings.captureStartup();

    const updated = MainAgentFeatureSettings.update({
      mcpEnabled: true,
      mcpPort: 45_678,
      mcpTools: ["agent-tool-track-detail"]
    });

    expect(updated).toMatchObject({
      mcpEnabled: true,
      mcpPort: 45_678,
      effective: { mcpEnabled: false, mcpPort: 32_123 },
      restartRequired: true
    });
    expect(updated.effective.mcpTools).toEqual(["agent-search", "agent-tool-track-detail"]);
  });

  it("MCP 只在真正监听后才标记为本次启动已启用", async () => {
    configValues.set("agentEnabled", false);
    configValues.set("mcpEnabled", true);
    configValues.set("mcpPort", 45_678);
    configValues.set("mcpTools", ["agent-search"]);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");

    const captured = MainAgentFeatureSettings.captureStartup();
    expect(captured.effective.mcpEnabled).toBe(false);
    expect(captured.restartRequired).toBe(true);
    expect(MainAgentFeatureSettings.beginMcpInitialization()).toMatchObject({
      mcpEnabled: true,
      mcpPort: 45_678,
      mcpTools: ["agent-search"]
    });

    const initialized = MainAgentFeatureSettings.markMcpInitialized(45_678);
    expect(initialized.effective.mcpEnabled).toBe(true);
    expect(initialized.restartRequired).toBe(false);
    expect(MainAgentFeatureSettings.beginMcpInitialization()).toBeUndefined();
  });

  it("公开 MCP 关闭但 Agent 启用时仍允许启动内部端点", async () => {
    configValues.set("agentEnabled", true);
    configValues.set("mcpEnabled", false);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");

    MainAgentFeatureSettings.captureStartup();
    expect(MainAgentFeatureSettings.beginMcpInitialization()).toMatchObject({
      agentEnabled: true,
      mcpEnabled: false
    });
  });

  it("关闭后即使本轮重新开启，也不会再次开放初始化", async () => {
    configValues.set("agentEnabled", true);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");
    MainAgentFeatureSettings.captureStartup();
    expect(MainAgentFeatureSettings.beginAgentInitialization()).toBe(true);
    MainAgentFeatureSettings.markAgentInitialized();

    MainAgentFeatureSettings.update({ agentEnabled: false });
    const stopped = MainAgentFeatureSettings.markAgentStopped();
    expect(stopped).toMatchObject({
      agentEnabled: false,
      effective: { agentEnabled: false },
      restartRequired: false
    });

    const reenabled = MainAgentFeatureSettings.update({ agentEnabled: true });
    expect(reenabled).toMatchObject({
      agentEnabled: true,
      effective: { agentEnabled: false },
      restartRequired: true
    });
    expect(MainAgentFeatureSettings.beginAgentInitialization()).toBe(false);
  });

  it("拒绝非法端口、重复工具和额外字段", async () => {
    configValues.set("agentEnabled", false);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");
    MainAgentFeatureSettings.captureStartup();
    configSet.mockClear();

    expect(() => MainAgentFeatureSettings.update({ mcpPort: 0 })).toThrow(
      "mcpPort 必须是 1024 到 65535 之间的整数"
    );
    expect(() =>
      MainAgentFeatureSettings.update({ mcpTools: ["agent-search", "agent-search"] })
    ).toThrow("mcpTools 不能包含重复工具");
    expect(() => MainAgentFeatureSettings.update({ mcpTools: ["agent-tool-private"] })).toThrow(
      "不在公开可选列表中"
    );
    expect(() => MainAgentFeatureSettings.update({ unexpected: true } as never)).toThrow(
      "包含不允许的字段"
    );
    expect(configSet).not.toHaveBeenCalled();
  });

  it("从公共白名单和真实工具定义生成可选择清单", async () => {
    configValues.set("agentEnabled", false);
    const { MainAgentFeatureSettings } = await import("@mahiru/app/services/agent/settings");

    expect(MainAgentFeatureSettings.getState().availableMcpTools).toEqual([
      {
        name: "agent-search",
        label: "搜索歌曲、专辑和艺人",
        description: "搜索歌曲、专辑和艺人。",
        risk: "read"
      },
      {
        name: "agent-tool-track-detail",
        label: "获取指定歌曲的详细信息",
        description: "获取指定歌曲的详细信息，支持批量查询。",
        risk: "read"
      },
      {
        name: "agent-tool-player-action",
        label: "控制播放器播放状态",
        description: "控制播放器播放状态。",
        risk: "write"
      },
      {
        name: "agent-tool-comment-send",
        label: "发送或回复评论",
        description: "发送或回复评论。",
        risk: "destructive"
      }
    ]);
  });
});
