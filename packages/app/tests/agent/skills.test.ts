import { LLMConversation, AIAgentSkillRegistry } from "@mahiru/ai";
import { createAiraAgentSkills } from "@mahiru/app/inner/agent/skills";
import { buildAgentToolRoutingText } from "@mahiru/app/inner/agent/tool-catalog";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("AiraMusic Agent skills", () => {
  const registry = new AIAgentSkillRegistry(createAiraAgentSkills());
  const conversation = LLMConversation.create({ id: "app-skill-test" }).unwrap();

  it("prepares a grounded evidence workflow for current-track introductions", () => {
    const activation = registry
      .activate({ input: "介绍一下当前播放的歌曲", conversation })
      .unwrap();

    expect(activation.activeSkillIDs).toEqual(["track-overview"]);
    expect(activation.toolNames).toEqual(
      expect.arrayContaining([
        "agent-search",
        "agent-tool-track-detail",
        "agent-tool-album-detail",
        "agent-tool-artist-detail",
        "agent-tool-artist-desc",
        "agent-tool-track-comment",
        "agent-tool-web-browser"
      ])
    );
    expect(activation.instructions.join("\n")).toContain("必须读取歌曲详细信息");
    expect(activation.instructions.join("\n")).toContain("至少读取一页");
    expect(activation.instructions.join("\n")).toContain("必须进行网页搜索");
    expect(activation.instructions.join("\n")).toContain("至少打开一个可信来源");
    expect(activation.instructions.join("\n")).toContain("评论只能代表听众的主观观点");
    expect(activation.instructions.join("\n")).toContain("scope=official");
    expect(activation.instructions.join("\n")).toContain("scope=music_news");
    expect(activation.instructions.join("\n")).toContain("scope=acg_news");
    expect(activation.instructions.join("\n")).toContain("scope=zhihu 只能补充署名观点");
    expect(activation.requiredEvidence.map((item) => item.id)).toEqual([
      "track-overview:track-detail",
      "track-overview:listener-comment",
      "track-overview:web-search",
      "track-overview:web-open"
    ]);
    expect(activation.requiredEvidence.at(-2)?.argumentEquals).toEqual({ action: "search" });
    expect(activation.requiredEvidence.at(-1)?.argumentEquals).toEqual({ action: "open" });
    expect(activation.requiredEvidence.at(-1)?.argumentFromEvidence).toEqual({
      argumentName: "url",
      evidenceID: "track-overview:web-search",
      outputPath: ["results", "url"]
    });
    expect(activation.requiredEvidence.every((item) => item.satisfaction === "attempt")).toBe(true);
    expect(activation.requiredEvidence.at(-1)?.dependsOn).toEqual(["track-overview:web-search"]);
    expect(
      registry.activate({ input: "介绍一下 ReoNa 的 ANIMA", conversation }).unwrap().activeSkillIDs
    ).toEqual(["track-overview"]);
    expect(
      registry.activate({ input: "介绍一下这个歌手", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
    expect(
      registry.activate({ input: "那它的创作背景呢？", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
    expect(
      registry
        .activate({
          input: "介绍当前播放歌曲\n那它的创作背景呢？",
          conversation
        })
        .unwrap().activeSkillIDs
    ).toEqual(["track-overview"]);
    expect(
      registry.activate({ input: "介绍一下你自己", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
    expect(
      registry.activate({ input: "介绍一下周杰伦", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
    expect(
      registry.activate({ input: "介绍《三体》", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
  });

  it.each(["介绍《晴天》这首歌", "介绍周杰伦的歌曲晴天"])(
    "能识别带有明确歌曲语义的中文作品介绍：%s",
    (input) => {
      expect(registry.activate({ input, conversation }).unwrap().activeSkillIDs).toEqual([
        "track-overview"
      ]);
    }
  );

  it.each([
    "介绍这个游戏的制作背景",
    "介绍一下它的制作背景",
    "为什么《三体》剧情好",
    "推荐一个电影",
    "发现一个 bug",
    "我发现这首歌有个错误",
    "我发现这个歌手的采访不错"
  ])("不会为陈述或明确的非音乐请求启用昂贵 Skill：%s", (input) => {
    expect(registry.activate({ input, conversation }).unwrap().activeSkillIDs).toEqual([]);
  });

  it("activates a web-grounded media-context workflow for plot and emotion explanations", () => {
    const activation = registry
      .activate({
        input: "结合《86》的动画剧情，解释当前歌曲这种绝望感从哪里来",
        conversation
      })
      .unwrap();

    expect(activation.activeSkillIDs).toEqual(["media-context-analysis"]);
    expect(activation.toolNames).toEqual(
      expect.arrayContaining([
        "agent-search",
        "agent-tool-track-detail",
        "agent-tool-track-lyrics",
        "agent-tool-track-comment",
        "agent-tool-web-browser"
      ])
    );
    expect(activation.instructions.join("\n")).toContain("必须进行网页搜索");
    expect(activation.instructions.join("\n")).toContain("至少打开一个可信来源");
    expect(activation.instructions.join("\n")).toContain("剧情事实");
    expect(activation.instructions.join("\n")).toContain("评论不能作为剧情或创作事实依据");
    expect(activation.instructions.join("\n")).toContain(
      "剧情、角色、歌曲使用场景等事实先用 scope=official"
    );
    expect(activation.instructions.join("\n")).toContain("scope=acg_news");
    expect(activation.instructions.join("\n")).toContain("scope=music_news");
    expect(activation.instructions.join("\n")).toContain(
      "scope=baidu_baike、wikipedia、moegirl 只能作为寻找一手来源的线索"
    );
    expect(activation.requiredEvidence.map((item) => item.id)).toEqual([
      "media-context-analysis:track-detail",
      "media-context-analysis:lyrics",
      "media-context-analysis:listener-comment",
      "media-context-analysis:web-search",
      "media-context-analysis:web-open"
    ]);
    expect(activation.requiredEvidence.at(-1)?.dependsOn).toEqual([
      "media-context-analysis:web-search"
    ]);
    expect(
      registry
        .activate({
          input: "结合《86》的动画剧情，介绍当前播放歌曲并解释情绪来源",
          conversation
        })
        .unwrap().activeSkillIDs
    ).toEqual(["media-context-analysis"]);
    expect(
      registry
        .activate({ input: "为什么当前歌曲听起来这么压抑，这种情绪从哪里来？", conversation })
        .unwrap().activeSkillIDs
    ).toEqual(["media-context-analysis"]);
    expect(
      registry.activate({ input: "那结合剧情讲讲呢？", conversation }).unwrap().activeSkillIDs
    ).toEqual(["media-context-analysis"]);
  });

  it("助手提出剧情分析后，确认短句会激活对应 Skill", () => {
    const followUpConversation = LLMConversation.create({
      id: "assistant-proposal-skill"
    }).unwrap();
    followUpConversation.appendMessage({ role: "user", content: "介绍当前播放歌曲" }).unwrap();
    followUpConversation
      .appendMessage({
        role: "assistant",
        content: "基本信息已经介绍完了。要不要结合动画剧情分析？"
      })
      .unwrap();
    followUpConversation.appendMessage({ role: "user", content: "可以" }).unwrap();

    const routingText = buildAgentToolRoutingText("可以", followUpConversation);
    const activation = registry.activate({
      input: routingText,
      conversation: followUpConversation
    });

    expect(activation.unwrap().activeSkillIDs).toEqual(["media-context-analysis"]);
  });

  it("requires real lyrics before interpretation without enabling web by default", () => {
    const activation = registry
      .activate({ input: "这首歌的歌词是什么意思，帮我解读一下", conversation })
      .unwrap();

    expect(activation.activeSkillIDs).toEqual(["lyric-interpretation"]);
    expect(activation.toolNames).toEqual([
      "agent-search",
      "agent-tool-track-detail",
      "agent-tool-track-lyrics"
    ]);
    expect(activation.instructions.join("\n")).toContain("开始解读前必须调用歌词工具");
    expect(activation.requiredEvidence.map((item) => item.id)).toEqual([
      "lyric-interpretation:lyrics"
    ]);
    expect(activation.toolNames).not.toContain("agent-tool-web-browser");
    expect(
      registry.activate({ input: "当前播放的歌想表达什么？", conversation }).unwrap().activeSkillIDs
    ).toEqual(["lyric-interpretation"]);
  });

  it("uses real similar/recommendation sources for discovery", () => {
    const activation = registry
      .activate({ input: "推荐几首和当前歌曲相似的歌", conversation })
      .unwrap();

    expect(activation.activeSkillIDs).toEqual(["grounded-recommendation"]);
    expect(activation.toolNames).toEqual(
      expect.arrayContaining([
        "agent-tool-track-similar",
        "agent-tool-track-recommend-daily",
        "agent-tool-track-recommend-new",
        "agent-tool-playlist-recommend"
      ])
    );
    expect(activation.instructions.join("\n")).toContain("不把模型记忆中的曲名");
    expect(activation.requiredEvidence.map((item) => item.id)).toEqual([
      "grounded-recommendation:real-candidates"
    ]);
    expect(activation.toolNames).not.toContain("agent-tool-web-browser");
  });

  it("composes workflows and leaves unrelated player commands untouched", () => {
    expect(
      registry.activate({ input: "介绍并解读这首歌的歌词是什么意思", conversation }).unwrap()
        .activeSkillIDs
    ).toEqual(["track-overview", "lyric-interpretation"]);
    expect(
      registry.activate({ input: "播放下一首", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
    expect(
      registry.activate({ input: "现在播放到哪里了", conversation }).unwrap().activeSkillIDs
    ).toEqual([]);
  });

  it("keeps safety, evidence and response rules in the stable prefix", () => {
    const rules = registry.stableInstructions();
    expect(rules).toHaveLength(4);
    expect(rules.join("\n")).toContain("不得编造资源 ID");
    expect(rules.join("\n")).toContain("先 search，再 open");
    expect(rules.join("\n")).toContain("不要机械复述问题");
  });
});
