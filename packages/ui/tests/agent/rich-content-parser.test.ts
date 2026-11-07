import { it, expect, describe } from "vitest";
import {
  parseAiraRichContent,
  AiraResourceCardSchema,
  type ParseAiraRichContentOptions
} from "@mahiru/ui/wins/agent/lib/rich-content";

const trackJSON = '{"kind":"track","id":1965919483,"action":"open","variant":"compact"}';

function visibleMarkdown(document: ReturnType<typeof parseAiraRichContent>) {
  return document.segments
    .filter((segment) => segment.type === "markdown")
    .map((segment) => segment.content)
    .join("");
}

describe("Aira 卡片协议兜底", () => {
  it.each([
    `\`\`\`aira-card\n${trackJSON}\n\`\`\``,
    `\`\`\`\`aira-card\n${trackJSON}\n\`\`\`\``,
    `~~~~aira-card\n${trackJSON}\n~~~~`
  ])("只恢复显式标记且可通过严格校验的卡片：%s", (block) => {
    const source = `前文。\n\n${block}\n\n后文。`;
    const document = parseAiraRichContent(source);

    expect(document.source).toBe(source);
    expect(document.cards).toEqual([
      { kind: "track", id: 1965919483, action: "play", variant: "compact" }
    ]);
    expect(visibleMarkdown(document)).toBe("前文。\n\n\n\n后文。");
    // 兼容层不会放宽协议本身对歌曲动作的限制。
    expect(AiraResourceCardSchema.safeParse(JSON.parse(trackJSON)).success).toBe(false);
  });

  it.each([
    '{"kind":"track","id":123,"dangerous":true}',
    '{"kind":"track","id":123,"action":"open","dangerous":true}',
    '{"kind":"track","id":"123","action":"open"}',
    '{"kind":"track","id":0}',
    '{"kind":"track","id":1.5}',
    '{"kind":"track","id":9007199254740992}',
    '{"kind":"track","id":123,"action":"delete"}',
    '{"kind":"video","id":123}',
    '{"kind":"track","id":123,"variant":"large"}',
    '{"kind":"track","id":123,}',
    '[{"kind":"track","id":123}]'
  ])("非法卡片隐藏源码并保留周围正文：%s", (body) => {
    const source = `前文。\n\n\`\`\`aira-card\n${body}\n\`\`\`\n\n后文。`;
    const document = parseAiraRichContent(source);

    expect(document.cards).toEqual([]);
    expect(document.pendingCard).toBeUndefined();
    expect(visibleMarkdown(document)).toBe("前文。\n\n\n\n后文。");
  });

  it.each([
    `\`\`\`json\n${trackJSON}\n\`\`\``,
    `\`\`\`\n${trackJSON}\n\`\`\``,
    `\`\`\`\naira-card\n\n${trackJSON}\n\`\`\``,
    `\`\`\`json\naira-card\n\n${trackJSON}\n\`\`\``,
    `\`\`\`text\naira-card\n${trackJSON}\n\`\`\``,
    `\`\`\`markdown\n\`\`\`aira-card\n${trackJSON}\n\`\`\`\n\`\`\``,
    `\`aira-card ${trackJSON}\``,
    `aira-card\n${trackJSON}`
  ])("保留普通 JSON、正文和代码示例：%s", (source) => {
    const document = parseAiraRichContent(source);

    expect(document.cards).toEqual([]);
    expect(visibleMarkdown(document)).toBe(source);
  });

  it.each([false, true])("不补全未闭合卡片（streaming=%s）", (streaming) => {
    const source = '前文。\n\n```aira-card\n{"kind":"track","id":123';
    const document = parseAiraRichContent(source, { streaming });

    expect(document.cards).toEqual([]);
    expect(document.pendingCard).toBe(streaming ? true : undefined);
    expect(visibleMarkdown(document)).toBe("前文。\n\n");
  });

  it.each<ParseAiraRichContentOptions>([
    { maxCards: 0 },
    { maxCardChars: 1 },
    { maxContentChars: 1 }
  ])("达到解析上限时仍隐藏显式卡片协议：%s", (options) => {
    const source = `前文。\n\n\`\`\`aira-card\n${trackJSON}\n\`\`\`\n\n后文。`;
    const document = parseAiraRichContent(source, options);

    expect(document.cards).toEqual([]);
    expect(visibleMarkdown(document)).toBe("前文。\n\n\n\n后文。");
  });

  it("到达卡片数量上限后隐藏其余协议并继续保留正文", () => {
    const block = `\`\`\`aira-card\n${trackJSON}\n\`\`\``;
    const document = parseAiraRichContent(`前文。\n${block}\n中间。\n${block}\n后文。`, {
      maxCards: 1
    });

    expect(document.cards).toHaveLength(1);
    expect(visibleMarkdown(document)).toBe("前文。\n\n中间。\n\n后文。");
  });
});
