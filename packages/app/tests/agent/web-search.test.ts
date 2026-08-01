import { z } from "zod";
import {
  AgentToolWebBrowser,
  resolveAgentWebBrowserInput
} from "@mahiru/app/inner/agent/agent-tool-web-browser";
import {
  createWebSearchURL,
  resolveSearchEngineOrder,
  createAcgRecoverySearchURL,
  resolveAgentWebSearchScope
} from "@mahiru/app/inner/agent/web-search";
import {
  createExtractPageScript,
  mergeAgentWebSearchPages,
  limitAgentWebPageToBudget,
  projectAgentWebSearchPage,
  isRelevantAgentWebSearchPage,
  AgentWebPageMaxSerializedChars,
  filterAgentWebSearchPageByDomains,
  AgentWebBrowserSecurityPreferences,
  filterAgentWebSearchResultsByQuery
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

  it("defaults general search to Bing（国内网络下 DDG 常不可达）", () => {
    const url = createWebSearchURL("  AiraMusic   Agent  ");

    expect(url.origin).toBe("https://www.bing.com");
    expect(url.searchParams.get("q")).toBe("AiraMusic Agent");
    expect(url.searchParams.get("count")).toBe("10");
    // 对齐 web-search-mcp direct Bing：form/cvid，避免 setlang 把流量打到 cn.bing 反爬页。
    expect(url.searchParams.get("form")).toBe("QBLH");
    expect(url.searchParams.get("cvid")).toMatch(/^[a-f0-9]{32}$/);
    expect(url.searchParams.get("setlang")).toBeNull();
    expect(resolveSearchEngineOrder()).toEqual(["bing", "baidu", "duckduckgo"]);
  });

  it("keeps DuckDuckGo lite URL shape when engine is explicit", () => {
    const url = createWebSearchURL("  AiraMusic   Agent  ", undefined, "duckduckgo");

    expect(url.origin).toBe("https://lite.duckduckgo.com");
    expect(url.pathname).toBe("/lite/");
    expect(url.searchParams.get("q")).toBe("AiraMusic Agent");
  });

  it("builds Baidu search URLs for the baidu engine", () => {
    const url = createWebSearchURL("イレヴンス", undefined, "baidu");
    expect(url.origin).toBe("https://www.baidu.com");
    expect(url.pathname).toBe("/s");
    expect(url.searchParams.get("wd")).toBe("イレヴンス");
  });

  it("CJK 空结果回退按单站 site 偏置，避免多站 OR 触发反爬", () => {
    const url = createAcgRecoverySearchURL("イレヴンス ポリスピカデリー");
    expect(url.origin).toBe("https://www.bing.com");
    expect(url.searchParams.get("q")).toBe("イレヴンス ポリスピカデリー site:zh.moegirl.org.cn");
    expect(createAcgRecoverySearchURL("イレヴンス", "w.atwiki.jp").searchParams.get("q")).toBe(
      "イレヴンス site:w.atwiki.jp"
    );
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

  it("一次搜索覆盖常用百科来源，避免模型逐站点重复查询", () => {
    const url = createWebSearchURL("Re:Zero ED", undefined, "bing", "encyclopedia");

    expect(url.searchParams.get("q")).toBe(
      "Re:Zero ED (site:zh.moegirl.org.cn OR site:baike.baidu.com OR site:wikipedia.org)"
    );
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

    expect(url.searchParams.get("q")).toBe("YOASOBI (官网 OR 官方网站 OR 公式 OR official)");
  });

  it("lets the legacy custom site override a preset on either engine", () => {
    const url = createWebSearchURL(
      "Responses API",
      "https://www.openai.com/docs/",
      "duckduckgo",
      "news"
    );

    expect(url.origin).toBe("https://lite.duckduckgo.com");
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
    expect(
      schema.safeParse({
        action: "open",
        url: "https://example.com/article",
        cursor: 8_000
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({ action: "open", url: "https://example.com/article", cursor: -1 }).success
    ).toBe(false);
    expect(schema.safeParse({ action: "search", query: "API", scope: "unknown" }).success).toBe(
      false
    );
    expect(schema.safeParse({ action: "open" }).success).toBe(false);
    expect(
      schema.parse({ action: "open", url: "https://example.com/article" }).maxChars
    ).toBeUndefined();
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
    expect(modelSchema).toContain("encyclopedia");
    expect(modelSchema).toContain("site");
  });

  it("让 detail 决定网页读取预算，同时保留绝对上限", () => {
    const parsed = new AgentToolWebBrowser().inputSchema.parse({
      action: "open",
      url: "https://example.com/article"
    });

    expect(resolveAgentWebBrowserInput(parsed, "compact")).toMatchObject({ maxChars: 3_500 });
    expect(resolveAgentWebBrowserInput(parsed, "standard")).toMatchObject({ maxChars: 8_000 });
    expect(resolveAgentWebBrowserInput(parsed, "detailed")).toMatchObject({ maxChars: 12_000 });
    expect(
      resolveAgentWebBrowserInput(
        new AgentToolWebBrowser().inputSchema.parse({
          action: "find",
          url: "https://example.com/article",
          pattern: "制作人"
        }),
        "detailed"
      )
    ).toMatchObject({ contextChars: 600, matchOffset: 0 });
  });

  it("固定站点范围会过滤搜索引擎混入的站外结果，并接受萌娘镜像子域", () => {
    const page = filterAgentWebSearchPageByDomains(
      {
        url: "https://www.bing.com/search?q=test",
        title: "搜索",
        content: "搜索结果",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        linkCount: 2,
        truncated: false,
        contentChars: 4,
        originalChars: 100,
        results: [
          {
            url: "https://mzh.moegirl.org.cn/Aira",
            title: "目标结果",
            domain: "mzh.moegirl.org.cn",
            snippet: "百科资料"
          },
          {
            url: "https://spam.example/Aira",
            title: "站外结果",
            domain: "spam.example",
            snippet: "无关内容"
          }
        ]
      },
      ["moegirl.org.cn"]
    );

    expect(page.results?.map((result) => result.domain)).toEqual(["mzh.moegirl.org.cn"]);
    expect(page.truncated).toBe(true);
  });

  it("搜索页优先提取主结果并忽略抢在前面的站内子链接", async () => {
    const dom = new JSDOM(
      `<!doctype html><body><main id="b_results">
        <li class="b_algo">
          <a href="https://first.example/about">站内简介</a>
          <h2><a href="https://first.example/article?utm_source=bing#top">第一条主结果</a></h2>
          <div class="b_caption"><p>第一条结果的可靠摘要。</p></div>
          <a href="https://first.example/news">站内新闻</a>
        </li>
        <li class="b_algo">
          <h2><a href="https://second.example/article">第二条主结果</a></h2>
          <div class="b_caption"><p>第二条结果摘要。</p></div>
        </li>
      </main></body>`,
      { runScripts: "outside-only", url: "https://www.bing.com/search?q=test" }
    );

    const result = await dom.window.eval(createExtractPageScript("search", 8_000));

    expect(result.results.map((item: { title: string }) => item.title)).toEqual([
      "第一条主结果",
      "第二条主结果"
    ]);
    expect(result.results[0]).toMatchObject({
      url: "https://first.example/article#top",
      snippet: "第一条结果的可靠摘要。"
    });
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
    expect(result.truncated).toBe(false);
  });

  it("结构化提取失败时不把反爬/导航 HTML 交给模型", () => {
    const page = {
      url: "https://www.bing.com/search?q=unknown",
      title: "unknown - 搜索",
      content: "<html>fallback nav links</html>",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: 12,
      truncated: false,
      contentChars: 30,
      originalChars: 30
    };

    const projected = projectAgentWebSearchPage(page);
    expect(projected.content).toContain("results 为空");
    expect(projected.content).not.toContain("fallback nav links");
  });

  it("DuckDuckGo lite 的 result-link 可提取并解开 uddg", async () => {
    const dom = new JSDOM(
      `<!doctype html><body><table>
        <tr><td>1.</td><td>
          <a class="result-link" rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fw.atwiki.jp%2Fhmiku%2Fpages%2F66701.html">
            イレヴンス - 初音ミク Wiki
          </a>
        </td></tr>
        <tr><td></td><td class="result-snippet">プロジェクトセカイへの書き下ろし楽曲。</td></tr>
      </table></body>`,
      { runScripts: "outside-only", url: "https://lite.duckduckgo.com/lite/?q=test" }
    );

    const result = await dom.window.eval(createExtractPageScript("search", 8_000));
    expect(result.results[0]).toMatchObject({
      url: "https://w.atwiki.jp/hmiku/pages/66701.html",
      domain: "w.atwiki.jp",
      title: "イレヴンス - 初音ミク Wiki",
      snippet: "プロジェクトセカイへの書き下ろし楽曲。"
    });
  });

  it("与查询无关的热门结果页不算可用搜索命中", () => {
    expect(
      isRelevantAgentWebSearchPage("イレヴンス ポリスピカデリー", {
        url: "https://cn.bing.com/search?q=test",
        title: "搜索",
        content: "x",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        linkCount: 2,
        truncated: false,
        contentChars: 1,
        originalChars: 1,
        results: [
          {
            url: "https://www.52pojie.cn/thread-1.html",
            domain: "52pojie.cn",
            title: "bilibili视频下载器",
            snippet: "四合一视频下载工具"
          },
          {
            url: "https://www.zhihu.com/topic/1",
            domain: "zhihu.com",
            title: "哔哩哔哩",
            snippet: "年轻人文化社区"
          }
        ]
      })
    ).toBe(false);
    expect(
      isRelevantAgentWebSearchPage("イレヴンス ポリスピカデリー", {
        url: "https://lite.duckduckgo.com/lite/?q=test",
        title: "搜索",
        content: "x",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        linkCount: 1,
        truncated: false,
        contentChars: 1,
        originalChars: 1,
        results: [
          {
            url: "https://w.atwiki.jp/hmiku/pages/66701.html",
            domain: "w.atwiki.jp",
            title: "イレヴンス - 初音ミク Wiki",
            snippet: "ポリスピカデリーの楽曲"
          }
        ]
      })
    ).toBe(true);
  });

  it("只命中弱词「初音」的页面不算相关，并会剪掉噪声结果", () => {
    const junk = [
      {
        url: "https://baike.baidu.com/item/Vivid",
        domain: "baike.baidu.com",
        title: "Vivid BAD SQUAD - 百度百科",
        snippet: "初音未来企划组合"
      },
      {
        url: "https://www.bilibili.com/video/1",
        domain: "bilibili.com",
        title: "初音ミク 超ボカニコ2022",
        snippet: "初音ミクメドレー"
      }
    ];
    expect(
      isRelevantAgentWebSearchPage("イレヴンス ポリスピカデリー 初音ミク", {
        url: "https://www.baidu.com/s?wd=test",
        title: "搜索",
        content: "x",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        linkCount: 2,
        truncated: false,
        contentChars: 1,
        originalChars: 1,
        results: junk
      })
    ).toBe(false);

    const mixed = filterAgentWebSearchResultsByQuery("イレヴンス ポリスピカデリー 初音ミク", [
      ...junk,
      {
        url: "https://mzh.moegirl.org.cn/Eleventh",
        domain: "mzh.moegirl.org.cn",
        title: "イレヴンス - 萌娘百科",
        snippet: "ポリスピカデリー 创作"
      }
    ]);
    expect(mixed.map((item) => item.domain)).toEqual(["mzh.moegirl.org.cn"]);
  });

  it("短拉丁词单独命中词典页不算相关（避免 Eleven 误匹配）", () => {
    expect(
      isRelevantAgentWebSearchPage("Eleven Polyspicadelly Hatsune Miku", {
        url: "https://cn.bing.com/search?q=test",
        title: "搜索",
        content: "x",
        fetchedAt: "2026-08-01T00:00:00.000Z",
        linkCount: 3,
        truncated: false,
        contentChars: 1,
        originalChars: 1,
        results: [
          {
            url: "https://baike.baidu.com/item/eleven/1",
            domain: "baike.baidu.com",
            title: "eleven（英文单词）",
            snippet: "数字十一"
          },
          {
            url: "https://dictionary.cambridge.org/eleven",
            domain: "dictionary.cambridge.org",
            title: "ELEVEN 翻译",
            snippet: "the number 11"
          },
          {
            url: "https://www.iciba.com/word?w=eleven",
            domain: "iciba.com",
            title: "eleven是什么意思",
            snippet: "爱词霸"
          }
        ]
      })
    ).toBe(false);
  });

  it("百度主结果节点可提取，并优先使用 mu 落地页", async () => {
    const dom = new JSDOM(
      `<!doctype html><body><div id="content_left">
        <div class="result c-container" mu="https://music.163.com/song?id=2710486454">
          <h3 class="t">
            <a href="http://www.baidu.com/link?url=abc123">イレヴンス_ポリスピカデリー_高音质在线试听</a>
          </h3>
          <div class="c-row">
            <span class="c-showurl">music.163.com/song</span>
            <span class="c-abstract">ポリスピカデリー 创作的 VOCALOID 曲。</span>
          </div>
        </div>
      </div></body>`,
      { runScripts: "outside-only", url: "https://www.baidu.com/s?wd=test" }
    );

    const result = await dom.window.eval(createExtractPageScript("search", 8_000));
    expect(result.results[0]).toMatchObject({
      title: "イレヴンス_ポリスピカデリー_高音质在线试听",
      domain: "music.163.com",
      url: "https://music.163.com/song?id=2710486454",
      snippet: "ポリスピカデリー 创作的 VOCALOID 曲。"
    });
  });

  it("反爬降级页缺少主结果节点时不得把热门链接当成搜索命中", async () => {
    const dom = new JSDOM(
      `<!doctype html><body>
        <nav>
          <a href="https://yandex.com/">Yandex</a>
          <a href="https://www.speedtest.net/">Speedtest</a>
          <a href="https://www.zhipin.com/">BOSS直聘</a>
        </nav>
        <main id="b_results"><p>暂无相关结果</p></main>
      </body>`,
      { runScripts: "outside-only", url: "https://cn.bing.com/search?q=test" }
    );

    const result = await dom.window.eval(createExtractPageScript("search", 8_000));
    expect(result.results).toEqual([]);
  });

  it("DuckDuckGo HTML 结果会解开 uddg 跳转并保留目标域名", async () => {
    const dom = new JSDOM(
      `<!doctype html><body><div class="results">
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fw.atwiki.jp%2Fhmiku%2Fpages%2F66701.html&amp;rut=abc">
              イレヴンス - 初音ミク Wiki
            </a>
          </h2>
          <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fw.atwiki.jp%2Fhmiku%2Fpages%2F66701.html">
            プロジェクトセカイへの書き下ろし楽曲。
          </a>
        </div>
        <div class="result">
          <h2 class="result__title">
            <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fvocadb.net%2FS%2F794963">
              イレヴンス - VocaDB
            </a>
          </h2>
        </div>
      </div></body>`,
      { runScripts: "outside-only", url: "https://html.duckduckgo.com/html/?q=test" }
    );

    const result = await dom.window.eval(createExtractPageScript("search", 8_000));
    expect(result.results.map((item: { url: string; domain: string }) => item.domain)).toEqual([
      "w.atwiki.jp",
      "vocadb.net"
    ]);
    expect(result.results[0]).toMatchObject({
      url: "https://w.atwiki.jp/hmiku/pages/66701.html",
      title: "イレヴンス - 初音ミク Wiki"
    });
  });

  it("合并备用搜索引擎结果时保留主引擎顺序并按规范化 URL 去重", () => {
    const createPage = (url: string, results: Array<{ url: string; title: string }>) => ({
      url,
      title: "搜索",
      content: "搜索页",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: results.length,
      truncated: false,
      contentChars: 3,
      originalChars: 100,
      results: results.map((result) => ({ ...result, domain: "example.com", snippet: "摘要" }))
    });
    const merged = mergeAgentWebSearchPages(
      createPage("https://www.bing.com/search?q=test", [
        { url: "https://first.example/article#top", title: "主结果" }
      ]),
      createPage("https://html.duckduckgo.com/html/?q=test", [
        { url: "https://first.example/article", title: "重复结果" },
        { url: "https://second.example/article", title: "备用结果" }
      ])
    );

    expect(merged.results?.map((result) => result.title)).toEqual(["主结果", "备用结果"]);
    expect(merged.url).toBe("https://www.bing.com/search?q=test");
  });

  it("主引擎无结构化结果时合并后改用备用引擎的 URL", () => {
    const createPage = (url: string, results: Array<{ url: string; title: string }>) => ({
      url,
      title: "搜索",
      content: "搜索页",
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: results.length,
      truncated: false,
      contentChars: 3,
      originalChars: 100,
      ...(results.length
        ? {
            results: results.map((result) => ({
              ...result,
              domain: "example.com",
              snippet: "摘要"
            }))
          }
        : {})
    });
    const merged = mergeAgentWebSearchPages(
      createPage("https://www.bing.com/search?q=test", []),
      createPage("https://html.duckduckgo.com/html/?q=test", [
        { url: "https://moegirl.example/page", title: "备用命中" }
      ])
    );

    expect(merged.url).toBe("https://html.duckduckgo.com/html/?q=test");
    expect(merged.results?.map((result) => result.title)).toEqual(["备用命中"]);
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

  it("二次 12K 预算缩短正文后同步更新 nextCursor，后续不会跳过未发送内容", () => {
    const content = Array.from(
      { length: 900 },
      (_, index) => `第 ${index + 1} 段正文，用于验证二次预算后的续读位置。`
    ).join("\n\n");
    const result = limitAgentWebPageToBudget({
      url: `https://example.com/article/${"metadata".repeat(300)}`,
      title: "超长百科标题".repeat(30),
      content,
      fetchedAt: "2026-07-18T00:00:00.000Z",
      linkCount: 0,
      truncated: true,
      contentChars: content.length,
      originalChars: content.length * 2,
      contentRange: {
        start: 0,
        end: content.length,
        total: content.length * 2,
        hasMore: true,
        nextCursor: content.length
      }
    });

    expect(JSON.stringify(result).length).toBeLessThanOrEqual(AgentWebPageMaxSerializedChars);
    expect(result.contentRange?.end).toBe(result.content.length);
    expect(result.contentRange?.nextCursor).toBe(result.contentRange?.end);
    expect(result.contentRange?.end).toBeLessThan(content.length);
    expect(result.content).not.toContain("[内容已按 Agent 12K 输出预算截断]");
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
    expect(result.contentRange).toMatchObject({ start: 0, hasMore: true });
    expect(result.contentRange.nextCursor).toBe(result.contentRange.end);
    expect(result.contentChars).toBeLessThanOrEqual(6_000);
    expect(result.content).not.toMatch(/<\/?[a-z][^>]*>/i);
  });

  it("长百科正文可使用 nextCursor 继续读取，不重复开头也不丢失后文", async () => {
    const paragraphs = Array.from(
      { length: 700 },
      (_, index) => `<p>第 ${index + 1} 段百科正文，包含这一段的唯一编号与资料说明。</p>`
    ).join("");
    const dom = new JSDOM(`<main><article><h1>长百科</h1>${paragraphs}</article></main>`, {
      runScripts: "outside-only",
      url: "https://example.com/encyclopedia"
    });

    const first = await dom.window.eval(createExtractPageScript("open", 6_000));
    const second = await dom.window.eval(
      createExtractPageScript("open", 6_000, first.contentRange.nextCursor)
    );

    expect(first.contentRange).toMatchObject({ start: 0, hasMore: true });
    expect(second.contentRange.start).toBe(first.contentRange.end);
    expect(second.contentRange.end).toBeGreaterThan(second.contentRange.start);
    expect(second.content).not.toContain("# 长百科");
    expect(second.content).not.toContain("第 1 段百科正文");
    expect(second.content).toMatch(/第 \d+ 段百科正文/);
    expect(second.contentRange.total).toBe(first.contentRange.total);
  });

  it("find 在长网页中只返回匹配片段和可继续读取的游标", async () => {
    const paragraphs = Array.from(
      { length: 400 },
      (_, index) =>
        `<p>第 ${index + 1} 段资料，${index === 287 ? "这里说明了特殊制作人的创作背景" : "普通背景资料"}。</p>`
    ).join("");
    const dom = new JSDOM(`<main><article><h1>作品百科</h1>${paragraphs}</article></main>`, {
      runScripts: "outside-only",
      url: "https://example.com/work"
    });

    const result = await dom.window.eval(
      createExtractPageScript("open", 6_000, 0, "特殊制作人", 240)
    );

    expect(result.content).toContain("已定位 1 处匹配");
    expect(result.find).toMatchObject({ pattern: "特殊制作人", totalMatches: 1 });
    expect(result.find.matches).toHaveLength(1);
    expect(result.find.matches[0].snippet).toContain("创作背景");
    expect(result.find.matches[0].openCursor).toBeGreaterThan(0);
    expect(result.find.matches[0].openCursor).toBeLessThan(result.find.matches[0].start);
    expect(result.content.length).toBeLessThan(200);
  });

  it("保留文章内部的百科信息框，同时继续移除正文外侧栏", async () => {
    const dom = new JSDOM(
      `<body>
        <main><article>
          <h1>歌曲百科</h1>
          <aside class="infobox"><table><tr><th>作曲</th><td>示例作曲家</td></tr></table></aside>
          <p>${"这是百科正文。".repeat(80)}</p>
        </article></main>
        <aside>站点推荐与广告</aside>
      </body>`,
      { runScripts: "outside-only", url: "https://example.com/infobox" }
    );

    const result = await dom.window.eval(createExtractPageScript("open", 8_000));

    expect(result.content).toContain("示例作曲家");
    expect(result.content).not.toContain("站点推荐与广告");
  });
});
