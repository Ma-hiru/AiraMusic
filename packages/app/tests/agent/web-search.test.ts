import { z } from "zod";
import { AgentToolWebBrowser } from "@mahiru/app/inner/agent/agent-tool-web-browser";
import { createWebSearchURL, resolveAgentWebSearchScope } from "@mahiru/app/inner/agent/web-search";
import {
  projectAgentWebSearchPage,
  AgentWebBrowserSecurityPreferences
} from "@mahiru/app/inner/agent/web-browser";

vi.mock("electron", () => ({
  app: { isReady: () => false },
  session: { fromPartition: vi.fn() },
  BrowserWindow: class {}
}));

describe("agent web search scopes", () => {
  it("保留 JS 引擎供隔离世界提取，同时不向页面开放 Node/Electron", () => {
    // javascript 必须为 true，否则 executeJavaScriptInIsolatedWorld 永不结算；
    // 页面脚本由 session 层 CSP + 拦截 script 资源封死，不靠关掉整帧 JS。
    expect(AgentWebBrowserSecurityPreferences).toMatchObject({
      javascript: true,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    });
  });

  it("keeps the general search URL backward compatible", () => {
    const url = createWebSearchURL("  AiraMusic   Agent  ");

    expect(url.origin).toBe("https://www.bing.com");
    expect(url.searchParams.get("q")).toBe("AiraMusic Agent");
    expect(url.searchParams.get("count")).toBe("10");
  });

  it.each([
    ["moegirl", "site:zh.moegirl.org.cn"],
    ["baidu_baike", "site:baike.baidu.com"],
    ["zhihu", "site:zhihu.com"],
    ["wikipedia", "site:wikipedia.org"]
  ] as const)("limits the %s preset with a site query", (scope, expression) => {
    const url = createWebSearchURL("Re:Zero ED", undefined, "bing", scope);

    expect(url.searchParams.get("q")).toBe(`Re:Zero ED ${expression}`);
  });

  it("uses multiple authoritative domains for the news preset", () => {
    const url = createWebSearchURL("音乐发行消息", undefined, "bing", "news");

    expect(url.searchParams.get("q")).toBe("音乐发行消息 (site:news.cn OR site:chinanews.com.cn)");
    expect(resolveAgentWebSearchScope("news")).toMatchObject({
      label: "新闻",
      domains: ["news.cn", "chinanews.com.cn"]
    });
  });

  it.each([
    ["music_news", "音乐新闻", ["natalie.mu", "oricon.co.jp", "billboard-japan.com"]],
    ["acg_news", "ACG 新闻", ["lisani.jp", "animeanime.jp", "animenewsnetwork.com", "natalie.mu"]]
  ] as const)("provides a quality-focused %s preset", (scope, label, domains) => {
    const resolved = resolveAgentWebSearchScope(scope);
    const query = createWebSearchURL("动画主题曲", undefined, "bing", scope).searchParams.get("q");

    expect(resolved.label).toBe(label);
    expect(resolved.domains).toEqual(domains);
    for (const domain of domains) expect(query).toContain(`site:${domain}`);
  });

  it("adds first-party intent for the official preset", () => {
    const url = createWebSearchURL("YOASOBI", undefined, "bing", "official");

    expect(url.searchParams.get("q")).toBe("YOASOBI (官网 OR 官方网站 OR official)");
  });

  it("lets the legacy custom site override a preset on either engine", () => {
    const url = createWebSearchURL(
      "Responses API",
      "https://www.openai.com/docs/",
      "duckduckgo",
      "news"
    );

    expect(url.origin).toBe("https://html.duckduckgo.com");
    expect(url.searchParams.get("q")).toBe("Responses API site:openai.com");
    expect(resolveAgentWebSearchScope("news", "www.openai.com")).toMatchObject({
      label: "指定站点",
      customSite: "openai.com",
      domains: ["openai.com"]
    });
  });

  it("exposes a discriminated and typed tool schema while accepting old site calls", () => {
    const schema = new AgentToolWebBrowser().inputSchema;

    expect(
      schema.safeParse({ action: "search", query: "角色歌曲", scope: "moegirl" }).success
    ).toBe(true);
    expect(
      schema.safeParse({ action: "search", query: "动画主题曲", scope: "acg_news" }).success
    ).toBe(true);
    expect(schema.safeParse({ action: "search", query: "API", site: "openai.com" }).success).toBe(
      true
    );
    expect(schema.safeParse({ action: "open", url: "https://example.com/article" }).success).toBe(
      true
    );
    expect(schema.safeParse({ action: "search", query: "API", scope: "unknown" }).success).toBe(
      false
    );
    expect(schema.safeParse({ action: "open" }).success).toBe(false);
    expect(schema.parse({ action: "open", url: "https://example.com/article" }).maxChars).toBe(
      12_000
    );
    expect(
      schema.safeParse({
        action: "open",
        url: "https://example.com/article",
        maxChars: 30_000
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        action: "open",
        url: "https://example.com/article",
        maxChars: 30_001
      }).success
    ).toBe(false);

    const modelSchema = JSON.stringify(z.toJSONSchema(schema));
    expect(z.toJSONSchema(schema)).toMatchObject({ type: "object" });
    expect(modelSchema).toContain("music_news");
    expect(modelSchema).toContain("acg_news");
    expect(modelSchema).toContain("site");
  });

  it("结构化结果可用时不再重复返回整页搜索 HTML", () => {
    const result = projectAgentWebSearchPage({
      url: "https://www.bing.com/search?q=STYX+HELIX",
      title: "STYX HELIX - 搜索",
      content: `<html><body>${"重复的搜索页内容".repeat(2_000)}</body></html>`,
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: 2,
      truncated: true,
      contentChars: 20_000,
      originalChars: 40_000,
      results: [
        {
          url: "https://example.com/styx-helix",
          title: "STYX HELIX",
          domain: "example.com",
          snippet: "歌曲与作品资料"
        }
      ]
    });

    expect(result.results).toHaveLength(1);
    expect(result.results?.[0]?.url).toBe("https://example.com/styx-helix");
    expect(result.content).toContain("results[].url");
    expect(result.content.length).toBeLessThan(128);
    expect(result.originalChars).toBe(40_000);
    expect(result.truncated).toBe(true);
  });

  it("结构化提取失败时保留搜索 HTML 作为回退", () => {
    const page = {
      url: "https://www.bing.com/search?q=unknown",
      title: "unknown - 搜索",
      content: "<html>fallback</html>",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: 0,
      truncated: false,
      contentChars: 21,
      originalChars: 21
    };

    expect(projectAgentWebSearchPage(page)).toBe(page);
  });
});
