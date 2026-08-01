import {
  isAgentToolError,
  getAgentToolSummary,
  parseAgentToolValue,
  getAgentWebToolDetails,
  isInternalAgentToolResult,
  getAgentToolSemanticResult
} from "@mahiru/ui/wins/agent/page/chat/tool-presentation";

describe("Agent tool presentation", () => {
  it("parses legacy double-encoded renderer output", () => {
    const legacy = JSON.stringify(JSON.stringify({ ok: true, message: "已完成" }));

    expect(parseAgentToolValue(legacy)).toEqual({ ok: true, message: "已完成" });
  });

  it("builds a human web-search summary and structured result details", () => {
    const input = JSON.stringify({
      action: "search",
      query: "AiraMusic GitHub",
      engine: "bing",
      scope: "moegirl"
    });
    const output = JSON.stringify({
      title: "AiraMusic - Search",
      url: "https://www.bing.com/search?q=AiraMusic",
      linkCount: 12,
      contentChars: 18000,
      originalChars: 24000,
      truncated: true,
      author: "Aira 编辑部",
      publishedAt: "2026-07-24T08:30:00.000Z",
      contentRange: {
        start: 0,
        end: 8000,
        total: 24000,
        hasMore: true,
        nextCursor: 8000
      },
      results: [
        {
          title: "AiraMusic repository",
          url: "https://github.com/example/airamusic",
          domain: "github.com",
          snippet: "Music player"
        }
      ],
      search: {
        scope: "moegirl",
        label: "萌娘百科",
        domains: ["zh.moegirl.org.cn"]
      }
    });

    expect(
      getAgentToolSummary({ name: "agent-tool-web-browser", input, output, running: false })
    ).toBe("萌娘百科 · AiraMusic - Search");
    expect(getAgentWebToolDetails(input, output)).toMatchObject({
      query: "AiraMusic GitHub",
      engine: "bing",
      linkCount: 12,
      truncated: true,
      scope: "moegirl",
      scopeLabel: "萌娘百科",
      scopeDomains: ["zh.moegirl.org.cn"],
      author: "Aira 编辑部",
      publishedAt: "2026-07-24T08:30:00.000Z",
      contentRange: {
        start: 0,
        end: 8000,
        total: 24000,
        hasMore: true,
        nextCursor: 8000
      },
      results: [{ title: "AiraMusic repository", domain: "github.com" }]
    });
  });

  it("recognizes normalized tool error results", () => {
    expect(isAgentToolError(JSON.stringify({ error: { type: "timeout", message: "超时" } }))).toBe(
      true
    );
    expect(isAgentToolError(JSON.stringify({ ok: true }))).toBe(false);
  });

  it("识别仅供内部恢复的工具结果", () => {
    expect(
      isInternalAgentToolResult(
        JSON.stringify({
          error: { type: "tool_not_selected", message: "内部工具路由不匹配" },
          _meta: { visibility: "internal" }
        })
      )
    ).toBe(true);
    expect(isInternalAgentToolResult(JSON.stringify({ ok: true }))).toBe(false);
  });

  it("projects music results into a short human summary before technical JSON", () => {
    const output = JSON.stringify({
      name: "夜に駆ける",
      artists: [{ name: "YOASOBI" }],
      album: { name: "THE BOOK" },
      playCount: 12500,
      tracks: [
        { name: "夜に駆ける", artists: [{ name: "YOASOBI" }] },
        { name: "群青", artists: [{ name: "YOASOBI" }] }
      ],
      _meta: { truncated: true }
    });

    expect(getAgentToolSemanticResult("agent-tool-playlist-detail", output)).toMatchObject({
      title: "夜に駆ける",
      description: "YOASOBI · THE BOOK",
      truncated: true,
      facts: [{ label: "播放", value: "1.3万" }],
      items: [
        { title: "夜に駆ける", subtitle: "YOASOBI" },
        { title: "群青", subtitle: "YOASOBI" }
      ]
    });
  });

  it("derives a domain when a web result omits it", () => {
    const details = getAgentWebToolDetails(
      JSON.stringify({ action: "search", query: "歌曲背景" }),
      JSON.stringify({
        results: [
          {
            title: "作品介绍",
            url: "https://music.example.com/article/1",
            snippet: "作品创作背景"
          }
        ]
      })
    );

    expect(details.results[0]?.domain).toBe("music.example.com");
  });

  it("labels vertical search scopes in legacy conversations without output metadata", () => {
    const details = getAgentWebToolDetails(
      JSON.stringify({ action: "search", query: "动画主题曲", scope: "acg_news" }),
      JSON.stringify({ results: [] })
    );

    expect(details.scopeLabel).toBe("ACG 新闻");
    expect(details.scope).toBe("acg_news");
  });

  it("为聚合百科搜索显示中文范围标签", () => {
    const details = getAgentWebToolDetails(
      JSON.stringify({ action: "search", query: "歌曲设定", scope: "encyclopedia" }),
      JSON.stringify({ results: [] })
    );

    expect(details.scopeLabel).toBe("百科资料");
    expect(details.scope).toBe("encyclopedia");
  });
});
