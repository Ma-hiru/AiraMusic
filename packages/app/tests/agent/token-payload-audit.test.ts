import { createAiraAgentSkills } from "@mahiru/app/inner/agent/skills";
import { createAgentToolCatalog } from "@mahiru/app/inner/agent/tool-catalog";
import {
  LLMConversation,
  LLMToolRegistry,
  AIAgentSkillRegistry,
  LLMConservativeTokenEstimator
} from "@mahiru/ai";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("Agent token 载荷预算", () => {
  it("普通对话只携带稳定的小型核心工具集", () => {
    const catalog = createAgentToolCatalog(false);
    const ordinaryNames = catalog.select("你好，最近怎么样？");
    const otherOrdinaryNames = catalog.select("说个简短的笑话");
    const tools = new LLMToolRegistry();
    tools.register(catalog.list).unwrap();
    const definitions = tools.definitions(true, ordinaryNames);
    const otherOrdinaryDefinitions = tools.definitions(true, otherOrdinaryNames);
    const toolSchemas = JSON.stringify(definitions);
    const estimator = new LLMConservativeTokenEstimator();

    expect(ordinaryNames).toEqual(otherOrdinaryNames);
    expect(definitions).toEqual(otherOrdinaryDefinitions);
    expect(definitions.map((definition) => definition.name)).toEqual([
      "agent-search",
      "agent-tool-capability-search"
    ]);
    expect(estimator.estimateText(toolSchemas)).toBeLessThanOrEqual(1_200);
  });

  it("限制歌曲剧情介绍工作流的固定提示与工具定义预算", () => {
    const input = "结合《86》的动画剧情，介绍当前播放歌曲并解释情绪来源";
    const conversation = LLMConversation.create({ id: "token-audit" }).unwrap();
    const skills = new AIAgentSkillRegistry(createAiraAgentSkills());
    const activation = skills.activate({ input, conversation }).unwrap();
    const catalog = createAgentToolCatalog(false);
    const selectedNames = Array.from(new Set([...catalog.select(input), ...activation.toolNames]));
    const tools = new LLMToolRegistry();
    tools.register(catalog.list).unwrap();
    const definitions = tools.definitions(true, selectedNames);
    const estimator = new LLMConservativeTokenEstimator();
    const stableRules = skills.stableInstructions().join("\n");
    const activeSkills = activation.instructions.join("\n");
    const toolSchemas = JSON.stringify(definitions);

    expect(activation.activeSkillIDs).toEqual(["media-context-analysis"]);
    expect(definitions.map((definition) => definition.name)).toEqual(
      expect.arrayContaining([
        "agent-search",
        "agent-tool-capability-search",
        "agent-tool-track-detail",
        "agent-tool-track-lyrics",
        "agent-tool-track-comment",
        "agent-tool-web-browser"
      ])
    );
    expect(definitions.map((definition) => definition.name)).not.toContain(
      "agent-tool-settings-get"
    );
    expect(stableRules.length).toBeLessThanOrEqual(1_700);
    expect(activeSkills.length).toBeLessThanOrEqual(1_200);
    expect(definitions.length).toBeGreaterThan(7);
    expect(definitions.length).toBeLessThanOrEqual(12);
    expect(toolSchemas.length).toBeGreaterThan(0);
    expect(estimator.estimateText(toolSchemas)).toBeLessThanOrEqual(4_000);
  });
});
