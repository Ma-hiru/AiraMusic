import { MainWebSearchPageConstants } from "@/constants/web";

export function paginateWebText(
  text: string,
  cursor = 0,
  maxChars: number = MainWebSearchPageConstants.DEFAULT_CONTENT_CHARS
) {
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > text.length) {
    throw new Error("正文游标超出范围，请使用上一结果的 nextCursor");
  }
  if (!Number.isInteger(maxChars) || maxChars <= 0) {
    throw new Error("正文分页长度必须为正整数");
  }
  const end = Math.min(
    text.length,
    cursor + Math.min(maxChars, MainWebSearchPageConstants.MAX_CONTENT_CHARS)
  );
  return {
    content: text.slice(cursor, end),
    contentRange: {
      start: cursor,
      end,
      totalChars: text.length,
      hasMore: end < text.length,
      nextCursor: end < text.length ? end : null
    }
  };
}

/** 给 MCP 的标准输出预算留余量；游标始终对应实际返回的正文。 */
export function paginateWebOutput<T extends object>(
  metadata: T & { links?: unknown[]; images?: unknown[] },
  text: string,
  cursor = 0,
  maxChars: number = MainWebSearchPageConstants.DEFAULT_CONTENT_CHARS
) {
  const page = paginateWebText(text, cursor, maxChars);
  const bounded = { ...metadata };
  if (bounded.links) bounded.links = bounded.links.slice(0, MainWebSearchPageConstants.MAX_LINKS);
  if (bounded.images)
    bounded.images = bounded.images.slice(0, MainWebSearchPageConstants.MAX_IMAGES);

  while (JSON.stringify(bounded).length > MainWebSearchPageConstants.METADATA_CHARS) {
    const items = bounded.links?.length ? bounded.links : bounded.images;
    if (!items?.length) throw new Error("网页元数据超出预算，请缩短标题、URL 或其他元数据");
    items.pop();
  }

  const full = { ...bounded, ...page };
  if (JSON.stringify(full).length <= MainWebSearchPageConstants.OUTPUT_CHARS) return full;

  // 完整候选已检查；剩余候选都不是末页，序列化长度随字符数单调增加。
  // 按 Unicode 字符边界取前缀，游标仍使用原正文的 UTF-16 偏移。
  const offsets = [0];
  for (const character of page.content)
    offsets.push(offsets[offsets.length - 1]! + character.length);
  let low = 1;
  let high = offsets.length - 2;
  let result: undefined | typeof full;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = { ...bounded, ...paginateWebText(text, cursor, offsets[middle]!) };
    if (JSON.stringify(candidate).length <= MainWebSearchPageConstants.OUTPUT_CHARS) {
      result = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (!result) throw new Error("网页输出预算不足，无法返回正文");
  return result;
}

/** 缓存也按序列化后的字符成本限制，避免控制字符转义后突破源文字预算。 */
export function boundWebPageCache<T extends { content: string; sourceTruncated?: boolean }>(
  data: T
): T {
  const metadataChars = JSON.stringify({ ...data, content: "" }).length;
  const originalBudget = MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS - metadataChars;
  const truncatedBudget =
    MainWebSearchPageConstants.MAX_PAGE_CACHE_CHARS -
    JSON.stringify({ ...data, content: "", sourceTruncated: true }).length;
  if (originalBudget < 0) throw new Error("网页缓存元数据超出预算");
  let spent = 0;
  let end = 0;
  let truncatedEnd = 0;
  for (const character of data.content) {
    const code = character.charCodeAt(0);
    const cost =
      character === '"' || character === "\\"
        ? 2
        : code < 32
          ? [8, 9, 10, 12, 13].includes(code)
            ? 2
            : 6
          : character.length === 1 && code >= 0xd800 && code <= 0xdfff
            ? 6
            : character.length;
    spent += cost;
    end += character.length;
    if (spent <= truncatedBudget) truncatedEnd = end;
    if (spent > originalBudget) {
      if (truncatedBudget < 0) throw new Error("网页缓存元数据超出预算");
      return { ...data, content: data.content.slice(0, truncatedEnd), sourceTruncated: true };
    }
  }
  return data;
}
