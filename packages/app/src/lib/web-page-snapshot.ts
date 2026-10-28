import { MainWebSearchPageConstants } from "@/constants/web";

/** 在页面内直接生成有界 HTML，避免把整棵 DOM 节点树传回主进程。 */
export function snapshotWebPage(limits = MainWebSearchPageConstants.SNAPSHOT_LIMITS) {
  let sourceTruncated = false;
  let visited = 0;
  let reserved = 0;
  let snapshot = "";
  const voidTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "source",
    "track",
    "wbr"
  ]);
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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
  const visit = (node: Node, depth: number) => {
    if (++visited > limits.maxNodes || depth > limits.maxDepth) {
      sourceTruncated = true;
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? "";
      const remaining = limits.maxChars - reserved - snapshot.length;
      if (value.length > remaining) sourceTruncated = true;
      const text = prefix(value, remaining).replace(/\s+/g, " ");
      if (!text.trim()) return;
      for (const character of text) {
        const escaped = escape(character);
        if (snapshot.length + escaped.length + reserved > limits.maxChars) {
          sourceTruncated = true;
          break;
        }
        snapshot += escaped;
      }
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.tagName.length > 64) {
      sourceTruncated = true;
      return;
    }
    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "svg"].includes(tag) || node.hasAttribute("hidden")) return;
    let attrs = "";
    const attr = (name: string, value: string) => {
      if (!value) return;
      if (value.length > limits.maxAttributeChars) {
        sourceTruncated = true;
        return;
      }
      attrs += ` ${name}="${escape(value)}"`;
    };
    attr("id", node.id);
    const urlAttr = (name: string) => {
      const raw = node.getAttribute(name) || "";
      if (raw.length > limits.maxAttributeChars) {
        sourceTruncated = true;
        return;
      }
      if (!raw) return;
      try {
        attr(name, new URL(raw, document.baseURI).href);
      } catch {
        /* 忽略无效地址。 */
      }
    };
    if (node instanceof HTMLImageElement) {
      urlAttr("src");
      attr("alt", node.alt);
    }
    if (node instanceof HTMLAnchorElement) urlAttr("href");
    const open = `<${tag}${attrs}>`;
    const close = voidTags.has(tag) ? "" : `</${tag}>`;
    if (snapshot.length + open.length + close.length + reserved > limits.maxChars) {
      sourceTruncated = true;
      return;
    }
    snapshot += open;
    reserved += close.length;
    for (let child = node.firstChild; child; child = child.nextSibling) {
      if (visited >= limits.maxNodes || snapshot.length + reserved >= limits.maxChars) {
        sourceTruncated = true;
        break;
      }
      visit(child, depth + 1);
    }
    reserved -= close.length;
    snapshot += close;
  };
  if (document.body) visit(document.body, 0);
  let title = "";
  const titleNode = document.querySelector("title");
  if (titleNode) {
    const walker = document.createTreeWalker(titleNode, NodeFilter.SHOW_ALL);
    let node: Node | null;
    let count = 0;
    while ((node = walker.nextNode())) {
      if (count++ >= 128 || title.length >= 500) {
        sourceTruncated = true;
        break;
      }
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const value = node.nodeValue ?? "";
      if (value.length > 500 - title.length) sourceTruncated = true;
      title += prefix(value, 500 - title.length);
    }
    title = title.replace(/\s+/g, " ").trim();
  }
  const url = location.href.length > 2_048 ? "" : location.href;
  if (!url) sourceTruncated = true;
  return { url, title, snapshot, sourceTruncated };
}

export function createWebPageSnapshotScript() {
  return `(${snapshotWebPage.toString()})(${JSON.stringify(MainWebSearchPageConstants.SNAPSHOT_LIMITS)})`;
}
