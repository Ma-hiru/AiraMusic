import { MainAgentSettings } from "@mahiru/app/inner/agent/settings";

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
vi.mock("@mahiru/app/inner/agent/tools", () => ({
  agentToolCatalog: {
    names: [
      "agent-search",
      "agent-tool-track-detail",
      "agent-tool-web-snapshot",
      "agent-tool-player-action",
      "agent-tool-comment-send"
    ],
    defaultNames: ["agent-search", "agent-tool-track-detail", "agent-tool-web-snapshot"]
  }
}));

const defaultSettings = {
  agentEnabled: true,
  mcpEnabled: false,
  mcpPort: MainAgentSettings.AgentFeatureDefaultMcpPort,
  mcpTools: ["agent-search", "agent-tool-track-detail", "agent-tool-web-snapshot"]
};

describe("Agent 持久配置", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configValues.clear();
  });

  it("纯读取返回默认配置，不隐式初始化或写入存储", () => {
    expect(MainAgentSettings.read()).toEqual(defaultSettings);
    expect(configSet).not.toHaveBeenCalled();
    expect(configValues.size).toBe(0);
  });

  it("显式初始化持久化缺失的默认值", () => {
    expect(MainAgentSettings.initialize()).toEqual(defaultSettings);
    expect(configSet).toHaveBeenCalledExactlyOnceWith(defaultSettings);
    expect(Object.fromEntries(configValues)).toEqual(defaultSettings);
  });

  it("初始化修复无效配置、迁移旧工具名并保留无关设置", () => {
    const storedTools = [" agent-tool-web-browser ", "agent-tool-web-snapshot", "unknown", 17];
    configValues.set("agentEnabled", "invalid");
    configValues.set("mcpEnabled", true);
    configValues.set("mcpPort", 1_023);
    configValues.set("mcpTools", storedTools);
    configValues.set("otherSetting", "keep");

    const initialized = MainAgentSettings.initialize();

    expect(initialized).toEqual({
      ...defaultSettings,
      mcpEnabled: true,
      mcpTools: ["agent-tool-web-snapshot"]
    });
    expect(configSet).toHaveBeenCalledExactlyOnceWith(initialized);
    expect(configValues.get("otherSetting")).toBe("keep");
    expect(storedTools).toEqual([
      " agent-tool-web-browser ",
      "agent-tool-web-snapshot",
      "unknown",
      17
    ]);
  });

  it("读取旧配置仅返回归一结果，迁移写入留给 initialize", () => {
    const storedTools = ["agent-tool-web-browser", " agent-search ", "agent-search", "unknown"];
    configValues.set("mcpTools", storedTools);

    expect(MainAgentSettings.read().mcpTools).toEqual(["agent-search", "agent-tool-web-snapshot"]);
    expect(configSet).not.toHaveBeenCalled();
    expect(configValues.get("mcpTools")).toEqual([
      "agent-tool-web-browser",
      " agent-search ",
      "agent-search",
      "unknown"
    ]);
  });

  it("返回的数组与存储及其他读取结果相互独立", () => {
    configValues.set("mcpTools", ["agent-search"]);
    const first = MainAgentSettings.read();
    const second = MainAgentSettings.read();
    first.mcpTools.push("agent-tool-track-detail");

    expect(second.mcpTools).toEqual(["agent-search"]);
    expect(configValues.get("mcpTools")).toEqual(["agent-search"]);
    expect(configSet).not.toHaveBeenCalled();
  });

  it("部分更新仅保存配置，不返回运行状态", () => {
    configValues.set("agentEnabled", false);
    const updated = MainAgentSettings.update({
      mcpEnabled: true,
      mcpPort: 45_678,
      mcpTools: ["agent-tool-track-detail"]
    });

    expect(updated).toEqual({
      agentEnabled: false,
      mcpEnabled: true,
      mcpPort: 45_678,
      mcpTools: ["agent-tool-track-detail"]
    });
    expect(configSet).toHaveBeenCalledExactlyOnceWith(updated);
    updated.mcpTools.push("agent-search");
    expect(configValues.get("mcpTools")).toEqual(["agent-tool-track-detail"]);
  });

  it("归一化工具名，忽略显式 undefined，并保持输入不变", () => {
    configValues.set("agentEnabled", false);
    const mcpTools = [" agent-tool-track-detail ", "agent-search"];

    const settings = MainAgentSettings.update({ agentEnabled: undefined, mcpTools });

    expect(settings.agentEnabled).toBe(false);
    expect(settings.mcpTools).toEqual(["agent-search", "agent-tool-track-detail"]);
    expect(mcpTools).toEqual([" agent-tool-track-detail ", "agent-search"]);
  });

  it.each([
    [{ mcpPort: 0 }, "mcpPort 必须是 1024 到 65535 之间的整数"],
    [{ mcpPort: 65_536 }, "mcpPort 必须是 1024 到 65535 之间的整数"],
    [{ mcpPort: 10_000.5 }, "mcpPort 必须是 1024 到 65535 之间的整数"],
    [{ agentEnabled: 1 }, "agentEnabled 必须是布尔值"],
    [{ mcpEnabled: "true" }, "mcpEnabled 必须是布尔值"],
    [{ mcpTools: ["agent-search", " agent-search "] }, "mcpTools 不能包含重复工具"],
    [{ mcpTools: ["unknown"] }, "不在公开可选列表中"],
    [{ mcpTools: [123] }, "mcpTools 只能包含字符串"],
    [{ unexpected: true }, "包含不允许的字段"],
    [null, "Agent 功能设置必须是对象"]
  ])("拒绝非法更新 %j 且不写入存储", (input, message) => {
    expect(() => MainAgentSettings.update(input as never)).toThrow(message as string);
    expect(configSet).not.toHaveBeenCalled();
    expect(configValues.size).toBe(0);
  });

  it("开启公开 MCP 时拒绝清空工具目录", () => {
    expect(() => MainAgentSettings.update({ mcpEnabled: true, mcpTools: [] })).toThrow(
      "至少需要选择一个公开工具"
    );
    expect(configSet).not.toHaveBeenCalled();
  });

  it("保留空或无效存储列表回退默认工具的行为", () => {
    for (const mcpTools of [[], ["unknown"], "invalid"]) {
      configValues.set("mcpTools", mcpTools);
      expect(MainAgentSettings.read().mcpTools).toEqual(defaultSettings.mcpTools);
    }
    const updated = MainAgentSettings.update({ mcpEnabled: false, mcpTools: [] });
    expect(updated.mcpTools).toEqual(defaultSettings.mcpTools);
    expect(configValues.get("mcpTools")).toEqual(defaultSettings.mcpTools);
  });
});
