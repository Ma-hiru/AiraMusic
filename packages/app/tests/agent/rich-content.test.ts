import type { LLMMessage } from "@mahiru/ai";

import { sanitizeAiraRichContent } from "../../src/inner/agent/rich-content";

describe("Agent 富内容证据校验", () => {
  it("只保留成功搜索结果中出现过的资源 ID", () => {
    const messages = toolExchange(
      "agent-search",
      { type: "track", keywords: "Stay Alive" },
      { songs: [{ id: 123, name: "Stay Alive" }] }
    );
    const text = [
      "[已验证歌曲](aira://track/123) 与 [虚构歌曲](aira://track/999)",
      "",
      "```aira-card",
      '{"kind":"track","id":123,"action":"play"}',
      "```",
      "",
      "```aira-card",
      '{"kind":"track","id":999}',
      "```"
    ].join("\n");

    const sanitized = sanitizeAiraRichContent(text, messages);

    expect(sanitized).toContain("[已验证歌曲](aira://track/123)");
    expect(sanitized).toContain("虚构歌曲");
    expect(sanitized).not.toContain("aira://track/999");
    expect(sanitized).toContain('{"kind":"track","id":123,"action":"play"}');
    expect(sanitized).not.toContain('{"kind":"track","id":999}');
    expect(sanitized).toContain("音乐资源卡片未通过本轮工具结果验证");
  });

  it("失败工具结果不能为资源卡片背书", () => {
    const messages = toolExchange(
      "agent-tool-track-detail",
      { id: 123 },
      { error: { type: "network", message: "请求失败" } }
    );

    expect(
      sanitizeAiraRichContent('```aira-card\n{"kind":"track","id":123}\n```', messages)
    ).not.toContain('{"kind":"track","id":123}');
  });

  it("评论工具按照真实资源类型记录输入 ID", () => {
    const messages = toolExchange(
      "agent-tool-track-comment",
      { id: 456, type: "album", page: 1 },
      { comments: [] }
    );

    expect(sanitizeAiraRichContent("[查看专辑](aira://album/456)", messages)).toContain(
      "aira://album/456"
    );
    expect(sanitizeAiraRichContent("[错误歌曲](aira://track/456)", messages)).toBe("错误歌曲");
  });
});

function toolExchange(name: string, args: unknown, output: unknown): LLMMessage[] {
  return [
    {
      role: "assistant",
      toolCalls: [{ name, callID: "call-1", arguments: JSON.stringify(args) }]
    },
    {
      role: "tool",
      name,
      callID: "call-1",
      content: JSON.stringify(output)
    }
  ];
}
