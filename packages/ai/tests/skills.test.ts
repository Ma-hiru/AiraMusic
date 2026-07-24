import { LLMConversation } from "@/conversations";
import { AIAgentSkillRegistry, type AIAgentInstructionDefinition } from "@/skills";

describe("AIAgentSkillRegistry", () => {
  it("keeps rules stable and activates multiple matched skills in registration order", () => {
    const conversation = LLMConversation.create({ id: "conversation-skills" }).unwrap();
    conversation.appendMessage({ role: "user", content: "上一轮在聊当前歌曲" });

    const registry = new AIAgentSkillRegistry([
      rule("grounded", "不要编造", ["search"]),
      skill("overview", "读取歌曲详情", /介绍/, ["detail", "search"]),
      skill("comments", "读取评论", /介绍|评论/, ["comments", "detail"]),
      skill("lyrics", "读取歌词", /歌词/, ["lyrics"])
    ]);

    expect(registry.stableInstructions()).toEqual([
      '<agent_rule id="grounded">\n不要编造\n</agent_rule>'
    ]);

    const activated = registry.activate({ input: "介绍当前歌曲", conversation }).unwrap();
    expect(activated.activeSkillIDs).toEqual(["overview", "comments"]);
    expect(activated.instructions).toEqual([
      '<active_skill id="overview">\n读取歌曲详情\n</active_skill>',
      '<active_skill id="comments">\n读取评论\n</active_skill>'
    ]);
    expect(activated.toolNames).toEqual(["search", "detail", "comments"]);
  });

  it("snapshots definitions so later host mutations cannot change the cache-stable prefix", () => {
    const instructions = ["稳定规则"];
    const toolNames = ["search", "search"];
    const registry = new AIAgentSkillRegistry([
      { id: "stable", kind: "rule", instructions, toolNames }
    ]);
    instructions[0] = "已被外部修改";
    toolNames.push("unexpected");

    expect(registry.stableInstructions()).toEqual([
      '<agent_rule id="stable">\n稳定规则\n</agent_rule>'
    ]);
    expect(
      registry
        .activate({
          input: "hello",
          conversation: LLMConversation.create({ id: "stable-snapshot" }).unwrap()
        })
        .unwrap().toolNames
    ).toEqual(["search"]);
  });

  it("gives matchers the conversation without mutating it", () => {
    const conversation = LLMConversation.create({ id: "conversation-history-matcher" }).unwrap();
    conversation.appendMessage({ role: "user", content: "我想找相似歌曲" });
    const before = conversation.snapshot();
    const registry = new AIAgentSkillRegistry([
      {
        id: "follow-up-recommendation",
        kind: "skill",
        instructions: "继续使用真实推荐结果",
        match: ({ input, conversation: history }) =>
          input === "继续" &&
          history.toMessages().some((message) => message.content?.includes("相似歌曲"))
      }
    ]);

    expect(registry.activate({ input: "继续", conversation }).unwrap().activeSkillIDs).toEqual([
      "follow-up-recommendation"
    ]);
    expect(conversation.snapshot()).toEqual(before);
  });

  it("activates namespaced evidence requirements and exposes their tools", () => {
    const registry = new AIAgentSkillRegistry([
      {
        id: "grounded-overview",
        kind: "skill",
        instructions: "先完成外部取证",
        match: () => true,
        requiredEvidence: [
          {
            id: "web-open",
            description: "打开网页正文",
            toolNames: ["web-browser"],
            argumentEquals: { action: "open" },
            argumentFromEvidence: {
              argumentName: "url",
              evidenceID: "web-search",
              outputPath: ["results", "url"]
            },
            satisfaction: "attempt",
            dependsOn: ["web-search"]
          },
          {
            id: "web-search",
            description: "搜索网页",
            toolNames: ["web-browser"],
            argumentEquals: { action: "search" },
            satisfaction: "attempt"
          }
        ]
      }
    ]);

    const activated = registry
      .activate({
        input: "介绍歌曲",
        conversation: LLMConversation.create({ id: "required-evidence" }).unwrap()
      })
      .unwrap();

    expect(activated.toolNames).toEqual(["web-browser"]);
    expect(activated.requiredEvidence).toEqual([
      {
        id: "grounded-overview:web-open",
        description: "打开网页正文",
        toolNames: ["web-browser"],
        argumentEquals: { action: "open" },
        argumentFromEvidence: {
          argumentName: "url",
          evidenceID: "grounded-overview:web-search",
          outputPath: ["results", "url"]
        },
        satisfaction: "attempt",
        dependsOn: ["grounded-overview:web-search"]
      },
      {
        id: "grounded-overview:web-search",
        description: "搜索网页",
        toolNames: ["web-browser"],
        argumentEquals: { action: "search" },
        satisfaction: "attempt"
      }
    ]);
  });

  it("rejects duplicate definitions and reports matcher failures", () => {
    const registry = new AIAgentSkillRegistry([rule("grounded", "不要编造")]);
    const duplicate = registry.register(rule("grounded", "仍然不要编造"));
    expect(duplicate.isErr()).toBe(true);
    if (duplicate.isErr()) expect(duplicate.reason.type).toBe("invalid_skill_config");
    expect(
      () => new AIAgentSkillRegistry([rule("same-batch", "第一条"), rule("same-batch", "第二条")])
    ).toThrow(/重复注册/);

    const broken = new AIAgentSkillRegistry([
      {
        id: "broken",
        kind: "skill",
        instructions: "不会被注入",
        match() {
          throw new Error("matcher bug");
        }
      }
    ]);
    const result = broken.activate({
      input: "hello",
      conversation: LLMConversation.create({ id: "broken-matcher" }).unwrap()
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) expect(result.reason.type).toBe("invalid_skill_config");

    expect(
      () =>
        new AIAgentSkillRegistry([
          {
            id: "bad-evidence",
            kind: "skill",
            instructions: "证据配置错误",
            match: () => true,
            requiredEvidence: [
              { id: "same", description: "第一项", toolNames: ["search"] },
              { id: "same", description: "第二项", toolNames: ["open"] }
            ]
          }
        ])
    ).toThrow(/证据 id/);
  });
});

function rule(
  id: string,
  instructions: string,
  toolNames?: string[]
): AIAgentInstructionDefinition {
  return { id, kind: "rule", instructions, toolNames };
}

function skill(
  id: string,
  instructions: string,
  pattern: RegExp,
  toolNames?: string[]
): AIAgentInstructionDefinition {
  return {
    id,
    kind: "skill",
    instructions,
    toolNames,
    match: ({ input }) => pattern.test(input)
  };
}
