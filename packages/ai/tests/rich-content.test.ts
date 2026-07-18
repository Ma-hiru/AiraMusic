import {
  parseAiraResourceURI,
  parseAiraRichContent,
  AiraRichContentLimits,
  AiraRichContentPrompt,
  formatAiraResourceURI,
  AiraResourceCardSchema,
  resolveAiraResourceAction
} from "@/rich-content";

describe("Aira 富内容协议", () => {
  it("只接受规范的应用资源链接", () => {
    expect(parseAiraResourceURI("aira://track/123")).toEqual({ kind: "track", id: 123 });
    expect(parseAiraResourceURI("aira://album/456")).toEqual({ kind: "album", id: 456 });
    expect(parseAiraResourceURI("aira://playlist/789")).toEqual({ kind: "playlist", id: 789 });
    expect(parseAiraResourceURI("aira://artist/42")).toEqual({ kind: "artist", id: 42 });

    for (const value of [
      "https://track/123",
      "aira://track/0",
      "aira://track/-1",
      "aira://track/01",
      "aira://track/1.5",
      "aira://track/1?play=true",
      "aira://unknown/1",
      "aira://TRACK/1",
      `aira://track/${Number.MAX_SAFE_INTEGER + 1}`
    ]) {
      expect(parseAiraResourceURI(value)).toBeNull();
    }
  });

  it("格式化资源链接并解析默认动作", () => {
    expect(formatAiraResourceURI({ kind: "playlist", id: 88 })).toBe("aira://playlist/88");
    expect(resolveAiraResourceAction({ kind: "track", id: 1 })).toBe("play");
    expect(resolveAiraResourceAction({ kind: "album", id: 2 })).toBe("open");
    expect(resolveAiraResourceAction({ kind: "playlist", id: 3, action: "queue" })).toBe("queue");
    expect(() => formatAiraResourceURI({ kind: "track", id: 0 })).toThrow(TypeError);
  });

  it("严格校验卡片 JSON", () => {
    expect(
      AiraResourceCardSchema.safeParse({
        kind: "track",
        id: 123,
        action: "play",
        variant: "featured"
      }).success
    ).toBe(true);
    expect(
      AiraResourceCardSchema.safeParse({ kind: "album", id: 1, unexpected: true }).success
    ).toBe(false);
    expect(AiraResourceCardSchema.safeParse({ kind: "track", id: "1" }).success).toBe(false);
    expect(AiraResourceCardSchema.safeParse({ kind: "track", id: 0 }).success).toBe(false);
    expect(
      AiraResourceCardSchema.safeParse({ kind: "track", id: 1, action: "delete" }).success
    ).toBe(false);
    expect(AiraResourceCardSchema.safeParse({ kind: "track", id: 1, action: "open" }).success).toBe(
      false
    );
    expect(
      AiraResourceCardSchema.safeParse({ kind: "track", id: 1, variant: "large" }).success
    ).toBe(false);
  });

  it("按原始顺序拆分正文与有效卡片", () => {
    const source = [
      "先说结论。",
      "",
      "```aira-card",
      '{"kind":"track","id":123,"action":"play","variant":"featured"}',
      "```",
      "",
      "还可以查看[同名专辑](aira://album/456)。"
    ].join("\n");

    const document = parseAiraRichContent(source);

    expect(document.source).toBe(source);
    expect(document.cards).toEqual([
      { kind: "track", id: 123, action: "play", variant: "featured" }
    ]);
    expect(document.segments).toEqual([
      { type: "markdown", content: "先说结论。\n\n" },
      {
        type: "card",
        card: { kind: "track", id: 123, action: "play", variant: "featured" }
      },
      { type: "markdown", content: "\n\n还可以查看[同名专辑](aira://album/456)。" }
    ]);
  });

  it("允许格式化的单个 JSON 对象", () => {
    const document = parseAiraRichContent(
      [
        "```aira-card",
        "{",
        '  "kind": "artist",',
        '  "id": 9,',
        '  "variant": "compact"',
        "}",
        "```"
      ].join("\n")
    );

    expect(document.cards).toEqual([{ kind: "artist", id: 9, variant: "compact" }]);
    expect(document.segments).toEqual([
      { type: "card", card: { kind: "artist", id: 9, variant: "compact" } }
    ]);
  });

  it("把非法、未闭合和嵌套在普通代码块中的卡片原样降级为 Markdown", () => {
    const invalid = [
      "```aira-card",
      '{"kind":"track","id":1,"extra":"not-allowed"}',
      "```",
      "",
      "```text",
      "```aira-card",
      '{"kind":"album","id":2}',
      "```",
      "```",
      "",
      "```aira-card",
      '{"kind":"track","id":3}'
    ].join("\n");

    expect(parseAiraRichContent(invalid)).toEqual({
      source: invalid,
      cards: [],
      segments: [{ type: "markdown", content: invalid }]
    });
  });

  it("流式解析隐藏末尾未闭合卡片，闭合后再转为卡片", () => {
    const pending = '前文。\n\n```aira-card\n{"kind":"track","id":123';
    expect(parseAiraRichContent(pending, { streaming: true })).toEqual({
      source: pending,
      cards: [],
      pendingCard: true,
      segments: [{ type: "markdown", content: "前文。\n\n" }]
    });
    expect(parseAiraRichContent(pending)).toEqual({
      source: pending,
      cards: [],
      segments: [{ type: "markdown", content: pending }]
    });

    const completed = `${pending}}\n\`\`\``;
    expect(parseAiraRichContent(completed, { streaming: true }).cards).toEqual([
      { kind: "track", id: 123 }
    ]);
  });

  it("超过数量、单卡大小或全文大小时保留原始 Markdown", () => {
    const first = ["```aira-card", '{"kind":"track","id":1}', "```"].join("\n");
    const second = ["```aira-card", '{"kind":"album","id":2}', "```"].join("\n");
    const source = `${first}\n${second}`;
    const limited = parseAiraRichContent(source, { maxCards: 1 });

    expect(limited.cards).toEqual([{ kind: "track", id: 1 }]);
    expect(limited.segments).toEqual([
      { type: "card", card: { kind: "track", id: 1 } },
      { type: "markdown", content: `\n${second}` }
    ]);

    const oversizedCard = parseAiraRichContent(first, { maxCardChars: 8 });
    expect(oversizedCard.cards).toEqual([]);
    expect(oversizedCard.segments).toEqual([{ type: "markdown", content: first }]);

    const oversizedContent = parseAiraRichContent(first, { maxContentChars: 8 });
    expect(oversizedContent.cards).toEqual([]);
    expect(oversizedContent.segments).toEqual([{ type: "markdown", content: first }]);
    expect(AiraRichContentLimits.maxCards).toBeGreaterThan(0);
  });

  it("系统提示词明确约束 ID 来源、展示层级和安全边界", () => {
    expect(AiraRichContentPrompt).toContain("只有工具结果明确确认");
    expect(AiraRichContentPrompt).toContain("不得猜测或编造 ID");
    expect(AiraRichContentPrompt).toContain("aira://track/<正整数 ID>");
    expect(AiraRichContentPrompt).toContain("```aira-card");
    expect(AiraRichContentPrompt).toContain("卡片不能替代正文");
  });
});
