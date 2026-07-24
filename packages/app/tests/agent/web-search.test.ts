import { z } from "zod";
import { AgentToolWebBrowser } from "@mahiru/app/inner/agent/agent-tool-web-browser";
import { createWebSearchURL, resolveAgentWebSearchScope } from "@mahiru/app/inner/agent/web-search";
import {
  createExtractPageScript,
  limitAgentWebPageToBudget,
  projectAgentWebSearchPage,
  AgentWebPageMaxSerializedChars,
  AgentWebBrowserSecurityPreferences
} from "@mahiru/app/inner/agent/web-browser";
// @ts-expect-error 根目录测试依赖未附带 jsdom 的类型声明。
import { JSDOM } from "jsdom";

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
      8_000
    );
    expect(
      schema.safeParse({
        action: "open",
        url: "https://example.com/article",
        maxChars: 12_000
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        action: "open",
        url: "https://example.com/article",
        maxChars: 12_001
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

  it("把完整搜索结果限制在 12K 内，并只删除尾部结果而不截断 URL", () => {
    const urls = Array.from(
      { length: 10 },
      (_, index) => `https://example.com/article/${index}/${"path".repeat(350)}`
    );
    const page = projectAgentWebSearchPage({
      url: "https://www.bing.com/search?q=long-result",
      title: "超长搜索结果",
      content: "搜索页原始正文".repeat(2_000),
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: urls.length,
      truncated: false,
      contentChars: 12_000,
      originalChars: 30_000,
      search: {
        query: "超长搜索结果",
        scope: "official",
        label: "官方资料",
        domains: []
      },
      results: urls.map((url, index) => ({
        url,
        title: `结果 ${index + 1}`,
        domain: "example.com",
        snippet: `第 ${index + 1} 条摘要：${"用于验证摘要优先压缩。".repeat(30)}`
      }))
    });

    const result = limitAgentWebPageToBudget(page);
    const serialized = JSON.stringify(result);

    expect(serialized.length).toBeLessThanOrEqual(AgentWebPageMaxSerializedChars);
    expect(result.truncated).toBe(true);
    expect(result.results?.length).toBeGreaterThan(0);
    expect(result.results?.length).toBeLessThan(urls.length);
    result.results?.forEach((item, index) => {
      expect(item.url).toBe(urls[index]);
      expect(() => new URL(item.url)).not.toThrow();
    });
  });

  it("仅压缩摘要即可满足预算时保留全部结构化搜索 URL", () => {
    const urls = Array.from({ length: 10 }, (_, index) => `https://example.com/article/${index}`);
    const result = limitAgentWebPageToBudget({
      url: "https://www.bing.com/search?q=long-snippet",
      title: "长摘要搜索结果",
      content: "搜索结果已整理到 results 字段。",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: urls.length,
      truncated: false,
      contentChars: "搜索结果已整理到 results 字段。".length,
      originalChars: 30_000,
      results: urls.map((url, index) => ({
        url,
        title: `结果 ${index + 1}`,
        domain: "example.com",
        snippet: `第 ${index + 1} 条摘要：${"摘要内容。".repeat(500)}`
      }))
    });

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(AgentWebPageMaxSerializedChars);
    expect(result.results).toHaveLength(urls.length);
    result.results?.forEach((item, index) => {
      expect(item.url).toBe(urls[index]);
      expect(item.snippet.length).toBeLessThan(2_500);
    });
  });

  it("按语义边界缩短 open 正文，使完整 AgentWebPage JSON 不超过 12K", () => {
    const content = Array.from(
      { length: 500 },
      (_, index) => `第 ${index + 1} 段正文，用于验证完整网页结果预算。`
    ).join("\n\n");
    const result = limitAgentWebPageToBudget({
      url: `https://example.com/article/${"long-path".repeat(300)}`,
      title: "制作人长篇访谈".repeat(20),
      author: "官方编辑部".repeat(20),
      publishedAt: "2026-07-20T08:30:00+09:00",
      content,
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: 8,
      truncated: false,
      contentChars: content.length,
      originalChars: content.length * 2
    });
    const serialized = JSON.stringify(result);
    const retained = result.content.replace("\n\n[内容已按 Agent 12K 输出预算截断]", "");

    expect(serialized.length).toBeLessThanOrEqual(AgentWebPageMaxSerializedChars);
    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[内容已按 Agent 12K 输出预算截断]");
    expect(result.contentChars).toBe(result.content.length);
    expect(retained.endsWith("。")).toBe(true);
  });

  it("只向模型返回紧凑的正文语义，不返回 DOM 结构与页面样板", async () => {
    const repeatedMarkup = Array.from(
      { length: 80 },
      (_, index) =>
        `<div class="layout"><span>正文第 ${index + 1} 段，包含用于验证提取质量的文字。</span></div>`
    ).join("");
    const source = `<!doctype html>
      <html>
        <head>
          <title>正文抽取测试</title>
          <meta name="description" content="用于验证摘要语义">
        </head>
        <body>
          <nav><button>登录</button><a href="/home">首页</a></nav>
          <main>
            <h1>核心标题</h1>
            <p>第一段正文，包含 <a href="/source?utm_source=test&keep=yes">资料来源</a>。</p>
            <ul><li>列表项目一</li><li>列表项目二</li></ul>
            ${repeatedMarkup}
          </main>
          <aside>相关推荐</aside>
          <footer>版权和下载按钮</footer>
        </body>
      </html>`;
    const dom = new JSDOM(source, {
      runScripts: "outside-only",
      url: "https://example.com/article"
    });

    const result = await dom.window.eval(createExtractPageScript("open", 12_000));

    expect(result.content).toContain("# 核心标题");
    expect(result.content).toContain("[资料来源](https://example.com/source?keep=yes)");
    expect(result.content).toContain("- 列表项目一");
    expect(result.content).not.toMatch(/<\/?(?:html|body|main|div|span|button)\b/i);
    expect(result.content).not.toContain("相关推荐");
    expect(result.content).not.toContain("版权和下载按钮");
    expect(result.content).not.toMatch(/[ \t]{2,}|\n{3,}/);
    expect(result.contentChars).toBeLessThan(source.length / 2);
    expect(result.contentChars).toBeLessThan(result.originalChars / 2);
  });

  it("在删除作者样板前保留网页署名与发布时间元数据", async () => {
    const dom = new JSDOM(
      `<!doctype html>
      <html>
        <head>
          <title>访谈资料</title>
          <meta name="author" content="  官方编辑部  ">
          <meta property="article:published_time" content="2026-07-20T08:30:00+09:00">
        </head>
        <body>
          <main>
            <article>
              <div class="author-box">页面内重复署名</div>
              <h1>制作人访谈</h1>
              <p>${"这是一段用于确认正文提取的访谈内容。".repeat(30)}</p>
            </article>
          </main>
        </body>
      </html>`,
      {
        runScripts: "outside-only",
        url: "https://example.com/interview"
      }
    );

    const result = await dom.window.eval(createExtractPageScript("open", 12_000));

    expect(result.author).toBe("官方编辑部");
    expect(result.publishedAt).toBe("2026-07-20T08:30:00+09:00");
    expect(result.content).not.toContain("页面内重复署名");
  });

  it("缺少 meta 时从署名元素与 time 元素提取结构化信息", async () => {
    const dom = new JSDOM(
      `<main>
        <article>
          <h1>歌曲资料</h1>
          <a rel="author" href="/authors/test">资料整理者</a>
          <time itemprop="datePublished" datetime="2025-12-01">2025 年 12 月 1 日</time>
          <p>${"正文内容用于确认轻量 DOM 元数据回退。".repeat(30)}</p>
        </article>
      </main>`,
      {
        runScripts: "outside-only",
        url: "https://example.com/music"
      }
    );

    const result = await dom.window.eval(createExtractPageScript("open", 12_000));

    expect(result.author).toBe("资料整理者");
    expect(result.publishedAt).toBe("2025-12-01");
  });

  it("不会把页面中无 datePublished 语义的普通 time 当作发布时间", async () => {
    const dom = new JSDOM(
      `<body>
        <header><time datetime="2030-01-01">站点活动倒计时</time></header>
        <main>
          <article>
            <h1>无发布时间的歌曲资料</h1>
            <p>${"正文内容用于确认普通 time 不会污染文章元数据。".repeat(30)}</p>
          </article>
        </main>
      </body>`,
      {
        runScripts: "outside-only",
        url: "https://example.com/no-published-time"
      }
    );

    const result = await dom.window.eval(createExtractPageScript("open", 12_000));

    expect(result.publishedAt).toBeUndefined();
  });

  it("正文超出预算时在语义边界裁剪且不超过字符上限", async () => {
    const paragraphs = Array.from(
      { length: 400 },
      (_, index) => `<p>第 ${index + 1} 段正文，用于验证长网页不会完整进入模型上下文。</p>`
    ).join("");
    const dom = new JSDOM(`<main><h1>长文章</h1>${paragraphs}</main>`, {
      runScripts: "outside-only",
      url: "https://example.com/long-article"
    });

    const result = await dom.window.eval(createExtractPageScript("open", 6_000));

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("[正文已截断，可提高 maxChars 后重新 open]");
    expect(result.contentChars).toBeLessThanOrEqual(6_000);
    expect(result.content).not.toMatch(/<\/?[a-z][^>]*>/i);
  });
});
