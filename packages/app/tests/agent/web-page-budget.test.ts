import { MainWebSearchPageConstants } from "@mahiru/app/constants/web";
import { paginateWebText, paginateWebOutput } from "@mahiru/app/utils/web-page";

describe("网页正文分页预算", () => {
  it("使用集中定义的默认正文长度并限制单页上限", () => {
    const text = "文".repeat(MainWebSearchPageConstants.MAX_CONTENT_CHARS + 10);
    expect(paginateWebText(text).content).toHaveLength(
      MainWebSearchPageConstants.DEFAULT_CONTENT_CHARS
    );
    expect(paginateWebText(text, 0, 100_000).content).toHaveLength(
      MainWebSearchPageConstants.MAX_CONTENT_CHARS
    );
  });

  it.each([0, -1, 1.5, NaN, Infinity])("拒绝不能前进的分页长度 %s", (maxChars) => {
    expect(() => paginateWebText("正文", 0, maxChars)).toThrow("正整数");
    expect(() => paginateWebOutput({}, "正文", 0, maxChars)).toThrow("正整数");
  });

  it.each([-1, 0.5, 4, NaN, Infinity])("拒绝非法正文游标 %s", (cursor) => {
    expect(() => paginateWebText("abc", cursor)).toThrow("游标");
    expect(() => paginateWebOutput({}, "abc", cursor)).toThrow("游标");
  });

  it.each([
    { text: "", cursor: 0 },
    { text: "正文", cursor: 2 }
  ])("空正文或到达末尾时终止分页：$cursor", ({ text, cursor }) => {
    const result = paginateWebOutput({ pageId: "page" }, text, cursor);
    expect(result).toEqual({
      pageId: "page",
      content: "",
      contentRange: {
        start: cursor,
        end: cursor,
        totalChars: text.length,
        hasMore: false,
        nextCursor: null
      }
    });
  });

  it("尾页只返回剩余正文，游标指向实际末尾", () => {
    const result = paginateWebOutput({}, "abcdef", 5, 500);
    expect(result).toEqual({
      content: "f",
      contentRange: { start: 5, end: 6, totalChars: 6, hasMore: false, nextCursor: null }
    });
  });

  it.each(['"\\\n\r\t\b\f\u0000\u001f', "😀\ud800x\udc00", "\u0000"])(
    "按序列化后的长度限制转义正文且保留可前进的游标",
    (fragment) => {
      const text = fragment.repeat(12_000);
      const result = paginateWebOutput({ title: "测试网页" }, text, 0, 12_000);
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(
        MainWebSearchPageConstants.OUTPUT_CHARS
      );
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content).toBe(text.slice(0, result.content.length));
      expect(result.contentRange).toEqual({
        start: 0,
        end: result.content.length,
        totalChars: text.length,
        hasMore: true,
        nextCursor: result.content.length
      });
    }
  );

  it("裁剪链接和图片以容纳页面元数据，并且不修改输入对象及数组", () => {
    const metadata = {
      pageId: "page",
      title: "长标题".repeat(400),
      url: "https://example.com/page",
      publishedAt: "2026-10-26",
      format: "markdown",
      warnings: ["保留这条提示"],
      links: Array.from({ length: 10 }, (_, id) => ({ id, url: "l".repeat(600) })),
      images: Array.from({ length: 6 }, (_, id) => ({ id, url: "i".repeat(600) }))
    };
    const original = structuredClone(metadata);
    Object.freeze(metadata.links);
    Object.freeze(metadata.images);
    Object.freeze(metadata);

    const result = paginateWebOutput(metadata, "\u0000".repeat(12_000), 0, 12_000);
    const { content, contentRange, ...boundedMetadata } = result;
    expect(JSON.stringify(boundedMetadata).length).toBeLessThanOrEqual(
      MainWebSearchPageConstants.METADATA_CHARS
    );
    expect(JSON.stringify(result).length).toBeLessThanOrEqual(
      MainWebSearchPageConstants.OUTPUT_CHARS
    );
    expect(content.length).toBeGreaterThan(0);
    expect(contentRange.nextCursor).toBe(content.length);
    expect(result.title).toBe(metadata.title);
    expect(result.links).toEqual([]);
    expect(result.images.length).toBeLessThan(metadata.images.length);
    expect(metadata).toEqual(original);
    expect(result.links).not.toBe(metadata.links);
    expect(result.images).not.toBe(metadata.images);
  });

  it("限制链接和图片条数并保留原数组", () => {
    const metadata = {
      links: Array.from({ length: 30 }, (_, id) => ({ id })),
      images: Array.from({ length: 20 }, (_, id) => ({ id }))
    };
    const result = paginateWebOutput(metadata, "正文");
    expect(result.links).toEqual(metadata.links.slice(0, MainWebSearchPageConstants.MAX_LINKS));
    expect(result.images).toEqual(metadata.images.slice(0, MainWebSearchPageConstants.MAX_IMAGES));
    expect(metadata.links).toHaveLength(30);
    expect(metadata.images).toHaveLength(20);
  });

  it("对无法通过裁剪数组满足预算的未知元数据明确报错", () => {
    const metadata = {
      pageId: "page",
      title: "t".repeat(MainWebSearchPageConstants.METADATA_CHARS / 2 + 1),
      url: "u".repeat(MainWebSearchPageConstants.METADATA_CHARS / 2 + 1),
      links: [{ url: "https://example.com" }],
      images: [{ url: "https://example.com/image.png" }]
    };
    const original = structuredClone(metadata);
    expect(() => paginateWebOutput(metadata, "正文")).toThrow("元数据超出预算");
    expect(() =>
      paginateWebOutput(
        { links: [], extra: "x".repeat(MainWebSearchPageConstants.METADATA_CHARS + 1) },
        ""
      )
    ).toThrow("元数据超出预算");
    expect(metadata).toEqual(original);
  });

  it("连续读取转义正文时每页前进，拼接后无丢字或重复", () => {
    const text = '正文"\\\n\u0000😀\ud800x\udc00'.repeat(2_000);
    const contents: string[] = [];
    let cursor = 0;
    while (cursor < text.length) {
      const result = paginateWebOutput({ title: "t".repeat(1_800) }, text, cursor, 12_000);
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(
        MainWebSearchPageConstants.OUTPUT_CHARS
      );
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.contentRange.start).toBe(cursor);
      expect(result.contentRange.end).toBe(cursor + result.content.length);
      contents.push(result.content);
      if (result.contentRange.nextCursor === null) {
        expect(result.contentRange.hasMore).toBe(false);
        expect(result.contentRange.end).toBe(text.length);
        break;
      }
      expect(result.contentRange.nextCursor).toBeGreaterThan(cursor);
      cursor = result.contentRange.nextCursor;
    }
    expect(contents.join("")).toBe(text);
  });
});
