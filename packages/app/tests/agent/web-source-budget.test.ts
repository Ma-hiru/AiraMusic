// @ts-expect-error 根目录测试依赖未附带 jsdom 的类型声明。
import { JSDOM } from "jsdom";
import { MainWebSearchPageConstants } from "@mahiru/app/constants/web";
import { createWebPageSnapshotScript } from "@mahiru/app/lib/web-page-snapshot";
import { boundWebPageCache, paginateWebOutput } from "@mahiru/app/utils/web-page";
import {
  createWebPageExtractionScript,
  createWebSearchExtractionScript
} from "@mahiru/app/lib/web-page-extractor";

const page = (html: string, url = "https://example.com/page") =>
  new JSDOM(html, { url, runScripts: "outside-only" });

describe("网页源数据前置预算", () => {
  it("小页面保留完整内容，不误报截断", () => {
    const dom = page(
      '<title>Title</title><main><h1>标题</h1><p>短正文</p><a href="/a">来源</a></main>'
    );
    const result = dom.window.eval(createWebPageExtractionScript({ format: "markdown" }));
    expect(result).toMatchObject({
      sourceTruncated: false,
      title: "Title",
      links: [{ text: "来源", url: "https://example.com/a" }]
    });
    expect(result.content).toContain("# 标题");
    expect(result.content).toContain("短正文");
    dom.window.close();
  });

  it("巨大文本在页面内限长，不先克隆完整正文 DOM", () => {
    const dom = page(`<p>${"大".repeat(300_000)}</p>`);
    const clone = vi.spyOn(dom.window.Node.prototype, "cloneNode");
    const result = dom.window.eval(
      createWebPageExtractionScript({ include_links: false, include_images: false })
    );
    expect(clone).not.toHaveBeenCalled();
    expect(result.sourceTruncated).toBe(true);
    expect(result.content.length).toBe(MainWebSearchPageConstants.MAX_SOURCE_CHARS);
    expect(JSON.stringify(result).length).toBeLessThan(130_000);
    dom.window.close();
  });

  it("节点与深度达到上限即停止复制，避免遍历剩余大树", () => {
    const dom = page("<div>x</div>".repeat(5_000));
    const create = vi.spyOn(dom.window.document, "createElement");
    const result = dom.window.eval(
      createWebPageExtractionScript({ include_links: false, include_images: false })
    );
    expect(create.mock.calls.length).toBeLessThan(
      MainWebSearchPageConstants.EXTRACTION_LIMITS.maxNodes
    );
    expect(result.sourceTruncated).toBe(true);
    expect(result.content.length).toBeLessThan(10_000);
    dom.window.close();
    const deep = page("<div>".repeat(100) + "deep text" + "</div>".repeat(100));
    const deepResult = deep.window.eval(createWebPageExtractionScript({}));
    expect(deepResult.sourceTruncated).toBe(true);
    expect(deepResult.content).toBe("");
    deep.window.close();
  });

  it("只取图片不创建正文克隆，元数据数量及字符串也有上限", () => {
    const dom = page(
      Array.from(
        { length: 100 },
        (_, i) =>
          `<figure><img src="/p${i}.jpg" width="200" alt="${"a".repeat(1_000)}"><figcaption>${"说明".repeat(500)}</figcaption></figure>`
      ).join("")
    );
    const clone = vi.spyOn(dom.window.Node.prototype, "cloneNode");
    const create = vi.spyOn(dom.window.document, "createElement");
    const result = dom.window.eval(
      createWebPageExtractionScript({
        include_content: false,
        include_links: false,
        include_images: true
      })
    );
    expect(clone).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    expect(result.content).toBe("");
    expect(result.images).toHaveLength(MainWebSearchPageConstants.EXTRACTION_LIMITS.maxImages);
    expect(
      result.images.every(
        (image: { alt: string; context: string }) =>
          image.alt.length <= 350 && image.context.length <= 350
      )
    ).toBe(true);
    expect(result.sourceTruncated).toBe(true);
    dom.window.close();
  });

  it("超长地址明确省略，不把截短地址当作来源或可点击链接", () => {
    const dom = page(
      `<a href="/${"x".repeat(5_000)}">oversize</a><a href="/ok">正常来源</a>`,
      "https://example.com/" + "x".repeat(5_000)
    );
    const result = dom.window.eval(createWebPageExtractionScript({}));
    expect(result.url).toBe("");
    expect(result.links).toEqual([{ text: "正常来源", url: "https://example.com/ok" }]);
    expect(result.sourceTruncated).toBe(true);
    dom.window.close();
  });

  it("快照在页面直接生成有界、闭合的 HTML 字符串", () => {
    const dom = page(`<title>T</title><article><p>${"<&".repeat(20_000)}</p></article>`);
    const clone = vi.spyOn(dom.window.Node.prototype, "cloneNode");
    const result = dom.window.eval(createWebPageSnapshotScript());
    expect(typeof result.snapshot).toBe("string");
    expect(result.snapshot.length).toBeLessThanOrEqual(
      MainWebSearchPageConstants.SNAPSHOT_LIMITS.maxChars
    );
    expect(result.snapshot).toContain("&lt;&amp;");
    expect(result.snapshot.endsWith("</p></article></body>")).toBe(true);
    expect(result.sourceTruncated).toBe(true);
    expect(clone).not.toHaveBeenCalled();
    dom.window.close();
  });

  it("快照同时限制极端节点、层级和属性，保留正常转义", () => {
    const dom = page(
      `<p id='a"b'>文本</p><img src="/${"x".repeat(5_000)}">` +
        "<div>".repeat(100) +
        "deep" +
        "</div>".repeat(100)
    );
    const result = dom.window.eval(createWebPageSnapshotScript());
    expect(result.snapshot).toContain('id="a&quot;b"');
    expect(result.snapshot).not.toContain("x".repeat(3_000));
    expect(result.snapshot).not.toContain("deep");
    expect(result.sourceTruncated).toBe(true);
    dom.window.close();
  });

  it.each(["bing", "baidu", "duckduckgo"] as const)(
    "%s 搜索结果在页面内限制元数据总预算",
    (engine) => {
      const items = Array.from(
        { length: 30 },
        (_, i) =>
          `<div class="${engine === "bing" ? "b_algo" : engine === "baidu" ? "c-container" : "result"}"><h2><a class="result__a" href="https://example.com/${i}/${"x".repeat(1_800)}">${"t".repeat(300)}</a></h2><p>${"s".repeat(1_000)}</p></div>`
      ).join("");
      const dom = page(
        `<div id="${engine === "bing" ? "b_results" : "content_left"}">${items}</div>`
      );
      const result = dom.window.eval(createWebSearchExtractionScript(engine, 10));
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.length).toBeLessThan(10);
      expect(result.hasMore).toBe(true);
      expect(result.sourceTruncated).toBe(true);
      expect(JSON.stringify(result.results).length).toBeLessThanOrEqual(
        MainWebSearchPageConstants.EXTRACTION_LIMITS.maxSearchChars
      );
      dom.window.close();
    }
  );

  it("正文源预算和 Markdown 扩展后的裁剪都不切开完整 emoji", () => {
    for (const [tag, padding, format] of [
      ["p", 1, "text"],
      ["h1", 3, "markdown"]
    ] as const) {
      const dom = page(
        `<${tag}>${"x".repeat(MainWebSearchPageConstants.MAX_SOURCE_CHARS - padding)}😀</${tag}>`
      );
      const data = dom.window.eval(
        createWebPageExtractionScript({ format, include_links: false, include_images: false })
      );
      expect(data.sourceTruncated).toBe(true);
      expect(data.content.length).toBeLessThanOrEqual(MainWebSearchPageConstants.MAX_SOURCE_CHARS);
      expect(/[\ud800-\udbff]$/.test(data.content)).toBe(false);
      expect(data.content.endsWith("x")).toBe(true);
      dom.window.close();
    }
  });

  it("快照预算落在 emoji 中间时保留 Unicode 边界和闭合标签", () => {
    const remaining =
      MainWebSearchPageConstants.SNAPSHOT_LIMITS.maxChars - "<body><p></p></body>".length;
    const dom = page(`<p>${"x".repeat(remaining - 1)}😀</p>`);
    const data = dom.window.eval(createWebPageSnapshotScript());
    expect(data.sourceTruncated).toBe(true);
    expect(data.snapshot).toHaveLength(MainWebSearchPageConstants.SNAPSHOT_LIMITS.maxChars - 1);
    expect(data.snapshot.endsWith("x</p></body>")).toBe(true);
    dom.window.close();
  });

  it("可选截断标志新增字段的 JSON 成本也计入缓存预算", () => {
    const original: { content: string; sourceTruncated?: boolean } = {
      content: "\u0000".repeat(90_000)
    };
    const data = boundWebPageCache(original);
    expect(data.sourceTruncated).toBe(true);
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(
      MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS
    );
    const exact = {
      content: "x".repeat(
        MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS - JSON.stringify({ content: "" }).length
      )
    };
    expect(boundWebPageCache(exact)).toBe(exact);
    expect(JSON.stringify(exact)).toHaveLength(MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS);
  });

  it("缓存预算计入控制字符和孤立代理项的 JSON 转义，续读只覆盖实际保留的正文", () => {
    const original = {
      content: '\u0000\ud800😀"\\'.repeat(30_000),
      sourceTruncated: false,
      title: "来源",
      links: []
    };
    const data = boundWebPageCache(original);
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(
      MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS
    );
    expect(data.sourceTruncated).toBe(true);
    expect(original.content.startsWith(data.content)).toBe(true);
    expect(original.sourceTruncated).toBe(false);
    const parts: string[] = [];
    let cursor = 0;
    while (cursor < data.content.length) {
      const result = paginateWebOutput(
        { sourceTruncated: data.sourceTruncated },
        data.content,
        cursor
      );
      parts.push(result.content);
      if (result.contentRange.nextCursor === null) {
        expect(result.contentRange.totalChars).toBe(data.content.length);
        break;
      }
      cursor = result.contentRange.nextCursor;
    }
    expect(parts.join("")).toBe(data.content);
  });
});
