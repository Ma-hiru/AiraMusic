// @ts-expect-error 根目录测试依赖未附带 jsdom 的类型声明。
import { JSDOM } from "jsdom";
import { paginateWebText, paginateWebOutput } from "@mahiru/app/utils/web-page";
import {
  createWebPageExtractionScript,
  createWebSearchExtractionScript
} from "@mahiru/app/lib/web-page-extractor";

describe("网页正文提取", () => {
  const html = `<title>作品资料</title><meta property="article:published_time" content="2026-10-08"><body><nav>导航噪声</nav><main><h1>作品</h1><div><h2>剧情</h2></div><p>甲与乙相遇，${"剧情内容。".repeat(40)}<a href="/source">原始来源</a></p><h2>评价</h2><p>读者评价</p><figure><img src="/hero.jpg" width="400" height="600" alt="主角"><figcaption>甲，女主角</figcaption></figure></main><footer>页脚噪声</footer></body>`;

  it("移除样板、保留 Markdown 标题与链接，提取日期和图片上下文", () => {
    const dom = new JSDOM(html, { url: "https://example.com/work", runScripts: "outside-only" });
    const data = dom.window.eval(createWebPageExtractionScript({ format: "markdown" }));
    expect(data.content).not.toMatch(/导航噪声|页脚噪声/);
    expect(data.content).toContain("## 剧情");
    expect(data.content).toContain("[原始来源](https://example.com/source)");
    expect(data.publishedAt).toBe("2026-10-08");
    expect(data.images[0]).toMatchObject({
      url: "https://example.com/hero.jpg",
      width: 400,
      height: 600,
      context: "甲，女主角"
    });
    dom.window.close();
  });

  it("只读正文时不遍历链接或图片，也不读取原始图片集合", () => {
    const dom = new JSDOM(html, { url: "https://example.com/work", runScripts: "outside-only" });
    const queries = vi.spyOn(dom.window.Element.prototype, "querySelectorAll");
    const imageCollection = vi.spyOn(dom.window.Document.prototype, "images", "get");

    const data = dom.window.eval(
      createWebPageExtractionScript({
        format: "markdown",
        include_links: false,
        include_images: false
      })
    );

    expect(data.content).toContain("## 剧情");
    expect(data.publishedAt).toBe("2026-10-08");
    expect(data.links).toEqual([]);
    expect(data.images).toEqual([]);
    expect(queries).not.toHaveBeenCalledWith("a[href]");
    expect(queries).not.toHaveBeenCalledWith("img");
    expect(imageCollection).not.toHaveBeenCalled();
    dom.window.close();
  });

  it("只取图片的序列化脚本不渲染正文、不提取日期或遍历链接", () => {
    const dom = new JSDOM(html, { url: "https://example.com/work", runScripts: "outside-only" });
    const queries = vi.spyOn(dom.window.Element.prototype, "querySelectorAll");
    const documentQueries = vi.spyOn(dom.window.document, "querySelector");
    const textReads = vi.fn();
    const readText = Object.getOwnPropertyDescriptor(
      dom.window.Node.prototype,
      "textContent"
    )!.get!;
    vi.spyOn(dom.window.Node.prototype, "textContent", "get").mockImplementation(function (this: {
      nodeType: number;
    }) {
      if (this.nodeType === 3) {
        textReads();
        throw new Error("不应渲染正文文本节点");
      }
      return readText.call(this);
    });

    const data = dom.window.eval(
      createWebPageExtractionScript({
        include_content: false,
        include_links: false,
        include_images: true
      })
    );

    expect(data.content).toBe("");
    expect(data.publishedAt).toBeNull();
    expect(data.links).toEqual([]);
    expect(data.images[0]).toMatchObject({
      url: "https://example.com/hero.jpg",
      width: 400,
      height: 600,
      context: "甲，女主角"
    });
    expect(textReads).not.toHaveBeenCalled();
    expect(queries).not.toHaveBeenCalledWith("a[href]");
    expect(documentQueries).not.toHaveBeenCalledWith('meta[property="article:published_time"]');
    expect(documentQueries).not.toHaveBeenCalledWith('meta[name="date"]');
    expect(documentQueries).not.toHaveBeenCalledWith("time[datetime]");
    dom.window.close();
  });

  it("链接和图片按 URL 保留首次出现结果，并使用首张原始图片的尺寸", () => {
    const dom = new JSDOM(
      `<title>去重</title><body><a href="/source">首次来源</a><a href="/source">重复来源</a><figure><img src="/hero.jpg" width="40" height="60"><img src="/hero.jpg" width="90" height="120"><figcaption>图片说明</figcaption></figure></body>`,
      { url: "https://example.com", runScripts: "outside-only" }
    );
    const images = dom.window.document.images;
    Object.defineProperty(images[0], "naturalWidth", { value: 400 });
    Object.defineProperty(images[0], "naturalHeight", { value: 600 });
    Object.defineProperty(images[1], "naturalWidth", { value: 900 });
    Object.defineProperty(images[1], "naturalHeight", { value: 1200 });

    const data = dom.window.eval(createWebPageExtractionScript({}));

    expect(data.links).toEqual([{ text: "首次来源", url: "https://example.com/source" }]);
    expect(data.images).toHaveLength(1);
    expect(data.images[0]).toMatchObject({ width: 400, height: 600, context: "图片说明" });
    dom.window.close();
  });

  it("按关键词定位标题所属段落，按选择器读取特定区域", () => {
    const dom = new JSDOM(html, { url: "https://example.com", runScripts: "outside-only" });
    const section = dom.window.eval(createWebPageExtractionScript({ keyword: "剧情" }));
    expect(section.content).toContain("甲与乙相遇");
    expect(section.content).not.toContain("读者评价");
    expect(
      dom.window.eval(createWebPageExtractionScript({ selector: "figure" })).content
    ).toContain("女主角");
    expect(() => dom.window.eval(createWebPageExtractionScript({ selector: "#missing" }))).toThrow(
      "未找到"
    );
    dom.window.close();
  });

  it("解码 Bing 跳转链接并返回结构化结果", () => {
    const url = "https://example.com/中文";
    const encoded = Buffer.from(url).toString("base64url");
    const dom = new JSDOM(
      `<div id="b_results"><li class="b_algo"><h2><a href="https://www.bing.com/ck/a?u=a1${encoded}">作品官网</a></h2><p>故事介绍</p></li></div>`,
      { url: "https://www.bing.com/search", runScripts: "outside-only" }
    );
    dom.window.TextDecoder = TextDecoder;
    const data = dom.window.eval(createWebSearchExtractionScript("bing", 6));
    expect(data.results[0]).toMatchObject({ title: "作品官网", url, isRedirect: false });
    expect(data.status).toBe("ok");
    dom.window.close();
  });

  it("分页不丢字，明确返回下一游标并拒绝越界", () => {
    const first = paginateWebText("abcdef", 0, 3);
    const second = paginateWebText("abcdef", first.contentRange.nextCursor!, 3);
    expect(first.content + second.content).toBe("abcdef");
    expect(second.contentRange).toMatchObject({ hasMore: false, nextCursor: null });
    expect(() => paginateWebText("abc", 4)).toThrow("游标");
  });

  it("长正文和链接在 MCP 预算内，游标与实际返回文字一致", () => {
    const text = '带引号"和换行\n'.repeat(2000);
    const result = paginateWebOutput(
      {
        links: Array.from({ length: 10 }, () => ({
          url: "https://example.com/" + "a".repeat(1000)
        }))
      },
      text,
      0,
      12000
    );
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(7400);
    expect(result.contentRange.nextCursor).toBe(result.content.length);
    expect(text.slice(0, result.content.length)).toBe(result.content);
  });
});
