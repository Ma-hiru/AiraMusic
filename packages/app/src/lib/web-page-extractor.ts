import { MainWebSearchPageConstants } from "@/constants/web";

export interface WebPageExtractionOptions {
  keyword?: string;
  selector?: string;
  include_links?: boolean;
  include_images?: boolean;
  include_content?: boolean;
  format?: "text" | "markdown";
}

// 序列化到隔离世界执行；限制值由脚本工厂显式传入。
export function extractWebPage(
  options: WebPageExtractionOptions = {},
  limits = MainWebSearchPageConstants.EXTRACTION_LIMITS
) {
  let sourceTruncated = false;
  const noise =
    "script,style,noscript,svg,nav,footer,[role=navigation],[role=banner],[role=contentinfo],[hidden],.adsbygoogle,.advertisement";
  const prefix = (value: string, max: number) => {
    let end = Math.min(value.length, max);
    if (
      end > 0 &&
      end < value.length &&
      value.charCodeAt(end - 1) >= 0xd800 &&
      value.charCodeAt(end - 1) <= 0xdbff &&
      value.charCodeAt(end) >= 0xdc00 &&
      value.charCodeAt(end) <= 0xdfff
    )
      end--;
    return value.slice(0, end);
  };
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  const boundedText = (element: Node, max: number, recordTruncation = false) => {
    let text = "";
    let visited = 0;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (visited++ >= 256 || text.length >= max) {
        if (recordTruncation) sourceTruncated = true;
        break;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue ?? "";
        if (recordTruncation && value.length > max - text.length) sourceTruncated = true;
        text += prefix(value, max - text.length);
      }
    }
    return clean(text);
  };
  const boundedURL = (value: null | string) => {
    if (!value) return "";
    if (value.length > limits.maxURLChars) {
      sourceTruncated = true;
      return "";
    }
    try {
      const url = new URL(value, document.baseURI);
      if (!/^https?:$/.test(url.protocol)) return "";
      if (url.href.length <= limits.maxURLChars) return url.href;
      sourceTruncated = true;
    } catch {
      /* 忽略无效地址。 */
    }
    return "";
  };
  const trimField = (value: string, max: number) => {
    if (value.length > max) sourceTruncated = true;
    return prefix(value, max);
  };
  const skip = (element: Element) => {
    if (element.matches(noise)) return true;
    if (element.tagName !== "HEADER") return false;
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ELEMENT);
    let node: Node | null;
    let links = 0;
    let visited = 0;
    while ((node = walker.nextNode()) && visited++ < 256) {
      if ((node as Element).tagName === "NAV") return true;
      if ((node as Element).tagName === "A" && ++links > 5) return true;
    }
    return false;
  };
  let source = document.body;
  if (options.selector) {
    const selected = document.querySelector(options.selector);
    if (!selected) throw new Error(`未找到选择器：${options.selector}`);
    source = selected as HTMLElement;
  } else {
    const candidate =
      document.querySelector("main,[role=main]") ?? document.querySelector("article");
    if (candidate && boundedText(candidate, 201).length > 200) source = candidate as HTMLElement;
  }

  // 只复制受预算约束的正文节点，不复制完整 DOM 或任意页面属性。
  if (options.include_content !== false || options.keyword) {
    let visited = 0;
    let characters = 0;
    let attributes = 0;
    const clone = (node: Node, depth: number): Node | null => {
      if (
        visited >= limits.maxNodes ||
        depth > limits.maxDepth ||
        characters >= limits.maxContentChars
      ) {
        sourceTruncated = true;
        return null;
      }
      visited++;
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue ?? "";
        const remaining = limits.maxContentChars - characters;
        if (value.length > remaining) sourceTruncated = true;
        const text = prefix(value, remaining);
        characters += value.length > remaining ? remaining : text.length;
        return document.createTextNode(text);
      }
      if (!(node instanceof Element) || skip(node)) return null;
      if (node.tagName.length > 64) {
        sourceTruncated = true;
        return null;
      }
      const result = document.createElement(node.tagName.toLowerCase());
      const attribute = (name: string, value: string) => {
        if (!value) return;
        const remaining = limits.maxAttributeChars - attributes;
        if (value.length > remaining) {
          sourceTruncated = true;
          return;
        }
        attributes += value.length;
        result.setAttribute(name, value);
      };
      if (node instanceof HTMLAnchorElement)
        attribute("href", boundedURL(node.getAttribute("href")));
      if (node instanceof HTMLImageElement) {
        attribute(
          "src",
          boundedURL(node.currentSrc || node.getAttribute("src") || node.getAttribute("data-src"))
        );
        attribute("alt", trimField(node.alt, limits.maxContextChars));
        attribute("width", String(node.naturalWidth || node.width));
        attribute("height", String(node.naturalHeight || node.height));
      }
      for (let child = node.firstChild; child; child = child.nextSibling) {
        if (visited >= limits.maxNodes || characters >= limits.maxContentChars) {
          sourceTruncated = true;
          break;
        }
        const copied = clone(child, depth + 1);
        if (copied) result.appendChild(copied);
      }
      return result;
    };
    source = (clone(source, 0) as null | HTMLElement) ?? document.createElement("div");
  }
  if (options.keyword) {
    const keyword = options.keyword.toLocaleLowerCase();
    const headings = [...source.querySelectorAll("h1,h2,h3,h4,h5,h6")];
    const heading = headings.find((node) =>
      clean(node.textContent ?? "")
        .toLocaleLowerCase()
        .includes(keyword)
    );
    const section = document.createElement("div");
    if (heading) {
      const next = headings
        .slice(headings.indexOf(heading) + 1)
        .find((node) => node.tagName <= heading.tagName);
      const range = document.createRange();
      range.setStartBefore(heading);
      if (next) range.setEndBefore(next);
      else range.setEnd(source, source.childNodes.length);
      section.append(range.cloneContents());
    } else {
      const matches = [...source.querySelectorAll("p,li,section,div")].filter((node) =>
        clean(node.textContent ?? "")
          .toLocaleLowerCase()
          .includes(keyword)
      );
      let found = 0;
      for (let i = 0; i < matches.length && found < 10; i++) {
        if (
          matches[i]!.querySelector("p,li,section,div") &&
          matches.slice(i + 1).some((other) => matches[i]!.contains(other))
        )
          continue;
        section.append(matches[i]!.cloneNode(true));
        found++;
      }
    }
    if (!section.textContent?.trim()) throw new Error(`未找到相关段落：${options.keyword}`);
    source = section;
  }

  const links: { url: string; text: string }[] = [];
  const images: { alt: string; url: string; width: number; height: number; context: string }[] = [];
  const linkURLs = new Set<string>();
  const imageURLs = new Set<string>();
  if (options.include_links !== false || options.include_images !== false) {
    let visited = 0;
    const visit = (element: Node, depth: number) => {
      if (++visited > limits.maxNodes || depth > limits.maxDepth) {
        sourceTruncated = true;
        return;
      }
      if (!(element instanceof Element) || skip(element)) return;
      if (options.include_links !== false && element instanceof HTMLAnchorElement) {
        const url = boundedURL(element.getAttribute("href"));
        if (url && !linkURLs.has(url)) {
          if (links.length < limits.maxLinks) {
            linkURLs.add(url);
            links.push({ text: boundedText(element, 150), url });
          } else sourceTruncated = true;
        }
      }
      if (options.include_images !== false && element instanceof HTMLImageElement) {
        const url = boundedURL(
          element.currentSrc || element.getAttribute("src") || element.getAttribute("data-src")
        );
        const width = element.naturalWidth || element.width;
        if (
          url &&
          !imageURLs.has(url) &&
          !/\.svg(?:\?|$)|logo|icon|spacer|tracking/i.test(url) &&
          !(width > 0 && width <= 2)
        ) {
          if (images.length < limits.maxImages) {
            imageURLs.add(url);
            let context = element.closest("figure")
              ? boundedText(element.closest("figure")!, limits.maxContextChars)
              : "";
            for (
              let parent = element.parentElement, depth = 0;
              !context && parent && depth < 4;
              parent = parent.parentElement, depth++
            )
              context = boundedText(parent, limits.maxContextChars);
            images.push({
              url,
              alt: trimField(element.alt, limits.maxContextChars),
              width,
              height: element.naturalHeight || element.height,
              context
            });
          } else sourceTruncated = true;
        }
      }
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (visited >= limits.maxNodes) {
          sourceTruncated = true;
          break;
        }
        visit(child, depth + 1);
      }
    };
    visit(source, 0);
  }
  const blocks = new Set([
    "P",
    "DIV",
    "SECTION",
    "ARTICLE",
    "MAIN",
    "UL",
    "OL",
    "LI",
    "TABLE",
    "TR",
    "BLOCKQUOTE",
    "FIGURE"
  ]);
  const render = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.nodeValue ?? "").replace(/\s+/g, " ");
    if (!(node instanceof Element)) return "";
    const tag = node.tagName;
    if (tag === "BR") return "\n";
    if (tag === "IMG") {
      const alt = node.getAttribute("alt")?.trim() || "";
      return alt.length > 12 ? `\n${alt}\n` : "";
    }
    const text = [...node.childNodes].map(render).join("").trim();
    if (!text) return "";
    if (options.format === "markdown") {
      if (/^H[1-6]$/.test(tag)) return `\n\n${"#".repeat(Number(tag[1]))} ${text}\n\n`;
      if (tag === "A") {
        const url = boundedURL(node.getAttribute("href"));
        return url ? `[${text}](${url})` : text;
      }
      if (tag === "LI") return `\n- ${text}\n`;
      if (tag === "STRONG" || tag === "B") return `**${text}**`;
    }
    if (blocks.has(tag) || /^H[1-6]$/.test(tag)) return `\n\n${text}\n\n`;
    return text + " ";
  };
  const meta = (selector: string) =>
    trimField(document.querySelector(selector)?.getAttribute("content") || "", 200).trim() || null;
  const content =
    options.include_content === false
      ? ""
      : render(source)
          .replace(/[ \t]+\n/g, "\n")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
  if (content.length > limits.maxContentChars) sourceTruncated = true;
  const publishedAt =
    options.include_content === false
      ? null
      : meta('meta[property="article:published_time"]') ||
        meta('meta[name="date"]') ||
        trimField(document.querySelector("time[datetime]")?.getAttribute("datetime") || "", 200) ||
        null;
  const titleNode = document.querySelector("title");
  const result = {
    url: boundedURL(location.href),
    title: titleNode ? boundedText(titleNode, limits.maxTitleChars, true) : "",
    publishedAt,
    content: prefix(content, limits.maxContentChars),
    links,
    images
  };
  return { ...result, sourceTruncated };
}

export function extractWebSearch(
  engine: "bing" | "baidu" | "duckduckgo",
  limit: number,
  limits = MainWebSearchPageConstants.EXTRACTION_LIMITS
) {
  const selectors = {
    bing: "#b_results .b_algo",
    baidu: "#content_left .result,#content_left .c-container",
    duckduckgo: ".result"
  };
  let sourceTruncated = false;
  const boundedText = (element: Node, max: number, recordTruncation = false) => {
    let text = "";
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_ALL);
    let node: Node | null;
    let visited = 0;
    while ((node = walker.nextNode())) {
      if (visited++ >= 128 || text.length >= max) {
        if (recordTruncation) sourceTruncated = true;
        break;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const value = node.nodeValue ?? "";
        if (recordTruncation && value.length > max - text.length) sourceTruncated = true;
        text += value.slice(0, max - text.length);
      }
    }
    return text.replace(/\s+/g, " ").trim();
  };
  const results: { url: string; title: string; snippet: string; isRedirect: boolean }[] = [];
  let budgetHasMore = false;
  const urls = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ALL);
  let node: Node | null;
  let visited = 0;
  while ((node = walker.nextNode())) {
    if (++visited > limits.maxNodes) {
      sourceTruncated = true;
      break;
    }
    if (!(node instanceof Element) || !node.matches(selectors[engine])) continue;
    const anchor = (node as Element).querySelector(
      "h2 a,h3 a,.result__a"
    ) as null | HTMLAnchorElement;
    if (!anchor) continue;
    let url = anchor.getAttribute("href") || "";
    if (url.length > limits.maxURLChars) {
      sourceTruncated = true;
      continue;
    }
    try {
      const parsed = new URL(url, document.baseURI);
      url = parsed.href;
      const encoded = parsed.searchParams.get("u");
      if (parsed.hostname.endsWith("bing.com") && encoded?.startsWith("a1")) {
        const binary = atob(encoded.slice(2).replace(/-/g, "+").replace(/_/g, "/"));
        url = new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
      }
      if (engine === "duckduckgo") url = parsed.searchParams.get("uddg") || url;
      if (engine === "baidu") {
        const tools = (node as Element).getAttribute("data-tools") || "{}";
        if (tools.length <= limits.maxURLChars)
          url = anchor.getAttribute("data-landurl") || JSON.parse(tools).url || url;
        else sourceTruncated = true;
      }
    } catch {
      /* 未识别跳转保留原地址。 */
    }
    if (url.length > limits.maxURLChars) {
      sourceTruncated = true;
      continue;
    }
    if (!/^https?:\/\//.test(url) || urls.has(url)) continue;
    urls.add(url);
    const result = {
      title: boundedText(anchor, 300),
      url,
      snippet: boundedText(node, 600),
      isRedirect: /bing\.com\/ck\/|baidu\.com\/link/.test(url)
    };
    if (JSON.stringify([...results, result]).length > limits.maxSearchChars) {
      sourceTruncated = budgetHasMore = true;
      break;
    }
    results.push(result);
    if (results.length > limit) break;
  }
  const titleNode = document.querySelector("title");
  const pageTitle = titleNode ? boundedText(titleNode, limits.maxTitleChars, true) : "";
  return {
    results: results.slice(0, limit),
    returnedCount: Math.min(results.length, limit),
    hasMore: budgetHasMore || results.length > limit,
    pageTitle,
    sourceTruncated,
    status: results.length
      ? "ok"
      : /captcha|验证|人机|robot/i.test(boundedText(document.body, 2_000))
        ? "blocked"
        : "empty"
  };
}

export function createWebPageExtractionScript(options: WebPageExtractionOptions) {
  return `(${extractWebPage.toString()})(${JSON.stringify(options)},${JSON.stringify(MainWebSearchPageConstants.EXTRACTION_LIMITS)})`;
}

export function createWebSearchExtractionScript(
  engine: "bing" | "baidu" | "duckduckgo",
  limit: number
) {
  return `(${extractWebSearch.toString()})(${JSON.stringify(engine)},${limit},${JSON.stringify(MainWebSearchPageConstants.EXTRACTION_LIMITS)})`;
}
