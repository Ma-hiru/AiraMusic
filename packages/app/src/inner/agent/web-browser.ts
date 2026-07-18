import { app, session, type Session, BrowserWindow } from "electron";

import { getAgentWebSafeProxyURL } from "./web-safe-proxy";
import { createWebSearchURL, resolveAgentWebSearchScope } from "./web-search";
import type { AgentWebSearchScope, AgentWebSearchEngine } from "./web-search";
import { assertPublicWebURL, canRequestPublicWebURL } from "./web-url-safety";

export type { AgentWebSearchScope, AgentWebSearchEngine } from "./web-search";
export {
  createWebSearchURL,
  AgentWebSearchScopeValues,
  resolveAgentWebSearchScope,
  normalizeAgentWebSearchSite
} from "./web-search";

// ========== 类型 ==========

export type AgentWebBrowserMode = "open" | "search";

export interface AgentWebBrowserSearchInput {
  query: string;
  site?: string;
  action: "search";
  scope?: AgentWebSearchScope;
  engine?: AgentWebSearchEngine;
}

export interface AgentWebBrowserOpenInput {
  url: string;
  action: "open";
  maxChars?: number;
}

export type AgentWebBrowserInput = AgentWebBrowserOpenInput | AgentWebBrowserSearchInput;

export interface AgentWebPage {
  url: string;
  title: string;
  content: string;
  fetchedAt: string;
  linkCount: number;
  truncated: boolean;
  contentChars: number;
  originalChars: number;
  search?: AgentWebSearchContext;
  results?: AgentWebSearchResult[];
}

export interface AgentWebSearchContext {
  label: string;
  query: string;
  domains: string[];
  customSite?: string;
  scope: AgentWebSearchScope;
}

export interface AgentWebSearchResult {
  url: string;
  title: string;
  domain: string;
  snippet: string;
}

const WebSearchStructuredContent =
  "搜索结果已整理到 results 字段；请从 results[].url 选择最相关的页面并使用 open 阅读正文。";

/**
 * 搜索页已经提取出标题、摘要和目标 URL 后，不再把同一批结果的 HTML 重复交给模型。
 * 若提取器没有得到结构化结果，则保留原始裁剪 HTML 作为兼容性回退。
 */
export function projectAgentWebSearchPage(page: AgentWebPage): AgentWebPage {
  if (!page.results?.length) return page;

  return {
    ...page,
    content: WebSearchStructuredContent,
    contentChars: WebSearchStructuredContent.length,
    truncated: page.truncated || page.contentChars > WebSearchStructuredContent.length
  };
}

// ========== 配置 ==========

const WebAgentPartition = "aira-web-agent";
const WebAgentMaxConcurrentWindows = 2;
const WebAgentLoadTimeoutMs = 20_000;
const WebAgentExtractTimeoutMs = 10_000;
const WebAgentDefaultMaxChars = 12_000;
const WebAgentIsolatedWorldID = 1001;

const BlockedResourceTypes = new Set([
  "image",
  "media",
  "font",
  "object",
  "ping",
  "cspReport",
  // 拦截外链脚本；页面内联脚本由响应头 CSP（script-src 'none'）一并封死
  "script",
  "websocket"
]);

/**
 * javascript 必须为 true：Chromium 在 javascript=false 时会禁用整帧 JS 引擎，
 * executeJavaScriptInIsolatedWorld 的 Promise 永远不结算，最终表现为「网页 DOM 提取超时」。
 *
 * 页面自身脚本仍不可执行——靠 CSP（script-src 'none'）+ 拦截 script/websocket 资源；
 * 提取脚本跑在隔离世界，不受页面 CSP 约束，也不向页面开放 Node/Electron 能力。
 */
export const AgentWebBrowserSecurityPreferences = Object.freeze({
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  javascript: true,
  images: false,
  backgroundThrottling: false
});

/** 禁止页面执行任何脚本，堵住 WebRTC 等绕过固定代理直连的路径 */
const AgentWebAgentContentSecurityPolicy = [
  "default-src 'none'",
  "img-src 'none'",
  "media-src 'none'",
  "font-src 'none'",
  "connect-src 'none'",
  "script-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'",
  "worker-src 'none'"
].join("; ");

// ========== 错误类型 ==========

class WebBrowserTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebBrowserTimeoutError";
  }
}

function createAbortError(): Error {
  const error = new Error("网页操作已取消");
  error.name = "AbortError";
  return error;
}

export function isWebBrowserAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function isWebBrowserTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === "WebBrowserTimeoutError";
}

// ========== 信号量（并发控制） ==========

class AsyncSemaphore {
  private active = 0;
  private readonly waiters: Array<{
    abort?: () => void;
    signal?: AbortSignal;
    reject: (error: Error) => void;
    resolve: (release: () => void) => void;
  }> = [];

  constructor(private readonly limit: number) {}

  async run<T>(callback: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const release = await this.acquire(signal);
    try {
      return await callback();
    } finally {
      release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(createAbortError());
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve(this.createRelease());
    }
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject, signal } as (typeof this.waiters)[0];
      const abort = () => {
        const idx = this.waiters.indexOf(waiter);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(createAbortError());
      };
      waiter.abort = abort;
      signal?.addEventListener("abort", abort, { once: true });
      this.waiters.push(waiter);
    });
  }

  private createRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      while (this.waiters.length > 0) {
        const waiter = this.waiters.shift()!;
        if (waiter.abort) waiter.signal?.removeEventListener("abort", waiter.abort);
        if (waiter.signal?.aborted) {
          waiter.reject(createAbortError());
          continue;
        }
        waiter.resolve(this.createRelease());
        return;
      }
      this.active -= 1;
    };
  }
}

const WebAgentSemaphore = new AsyncSemaphore(WebAgentMaxConcurrentWindows);

let SharedWebAgentSessionPromise: undefined | Promise<Session>;

// ========== URL 安全检查 ==========

// ========== 公开入口 ==========

export async function executeWebBrowser(
  input: AgentWebBrowserInput,
  signal?: AbortSignal
): Promise<AgentWebPage> {
  if (input.action === "search") {
    const resolvedScope = resolveAgentWebSearchScope(input.scope, input.site);
    const url = createWebSearchURL(input.query, input.site, input.engine, input.scope);
    const page = projectAgentWebSearchPage(await openWebPage({ url, mode: "search", signal }));
    return {
      ...page,
      search: {
        query: input.query,
        scope: resolvedScope.scope,
        label: resolvedScope.label,
        domains: resolvedScope.domains,
        ...(resolvedScope.customSite ? { customSite: resolvedScope.customSite } : {})
      }
    };
  }
  return openWebPage({
    url: input.url,
    mode: "open",
    signal,
    maxChars: input.maxChars
  });
}

interface OpenWebPageOptions {
  maxChars?: number;
  url: URL | string;
  signal?: AbortSignal;
  mode: AgentWebBrowserMode;
}

async function openWebPage(options: OpenWebPageOptions): Promise<AgentWebPage> {
  if (!app.isReady()) throw new Error("Electron app 尚未 ready");
  const url = await assertPublicWebURL(options.url);
  const maxChars = clamp(options.maxChars ?? WebAgentDefaultMaxChars, 6_000, 30_000);
  return WebAgentSemaphore.run(
    () => openWebPageInWindow({ url, mode: options.mode, maxChars, signal: options.signal }),
    options.signal
  );
}

// ========== 隐藏 BrowserWindow ==========

async function openWebPageInWindow(options: {
  url: URL;
  maxChars: number;
  signal?: AbortSignal;
  mode: AgentWebBrowserMode;
}): Promise<AgentWebPage> {
  const webSession = await getWebAgentSession();
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      ...AgentWebBrowserSecurityPreferences,
      session: webSession
    }
  });

  const contents = win.webContents;
  contents.setAudioMuted(true);
  contents.setUserAgent(createBrowserUserAgent());
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-prevent-unload", (event) => event.preventDefault());
  const preventUnsafeNavigation = (event: Electron.Event, target: string) => {
    try {
      const protocol = new URL(target).protocol;
      if (protocol !== "http:" && protocol !== "https:") event.preventDefault();
    } catch {
      event.preventDefault();
    }
  };
  contents.on("will-navigate", preventUnsafeNavigation);
  contents.on("will-redirect", preventUnsafeNavigation);

  try {
    await loadURLWithTimeout(win, options.url.toString(), options.signal);
    const finalURL = contents.getURL();
    await assertPublicWebURL(finalURL);
    // 页面载入完成后锁定导航，避免提取期间被脚本切换到另一个文档。
    contents.on("will-navigate", (event) => event.preventDefault());
    contents.on("will-redirect", (event) => event.preventDefault());
    const result = await runWithTimeout(
      contents.executeJavaScriptInIsolatedWorld(WebAgentIsolatedWorldID, [
        { code: createExtractPageScript(options.mode, options.maxChars) }
      ]) as Promise<ExtractedPageResult>,
      WebAgentExtractTimeoutMs,
      options.signal,
      "网页 DOM 提取超时"
    );
    return {
      url: finalURL,
      title: result.title,
      content: result.content,
      fetchedAt: new Date().toISOString(),
      truncated: result.truncated,
      originalChars: result.originalChars,
      contentChars: result.contentChars,
      linkCount: result.linkCount,
      ...(result.results.length ? { results: result.results } : {})
    };
  } finally {
    if (!win.isDestroyed()) {
      contents.stop();
      win.destroy();
    }
  }
}

interface ExtractedPageResult {
  title: string;
  content: string;
  linkCount: number;
  truncated: boolean;
  contentChars: number;
  originalChars: number;
  results: AgentWebSearchResult[];
}

// ========== 独立 Session ==========

function getWebAgentSession(): Promise<Session> {
  if (SharedWebAgentSessionPromise) return SharedWebAgentSessionPromise;
  SharedWebAgentSessionPromise = createWebAgentSession().catch((error) => {
    SharedWebAgentSessionPromise = undefined;
    throw error;
  });
  return SharedWebAgentSessionPromise;
}

async function createWebAgentSession(): Promise<Session> {
  const webSession = session.fromPartition(WebAgentPartition, { cache: false });
  const safeProxyURL = await getAgentWebSafeProxyURL();
  await webSession.setProxy({
    mode: "fixed_servers",
    proxyRules: safeProxyURL,
    proxyBypassRules: "<-loopback>"
  });
  webSession.setPermissionCheckHandler(() => false);
  webSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  webSession.on("will-download", (event) => event.preventDefault());
  webSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      if (BlockedResourceTypes.has(details.resourceType)) {
        callback({ cancel: true });
        return;
      }
      void canRequestPublicWebURL(details.url).then(
        (allowed) => callback({ cancel: !allowed }),
        () => callback({ cancel: true })
      );
    }
  );
  // 覆盖站点原有 CSP：页面脚本（含内联）一律禁止；隔离世界提取不受此限制
  webSession.webRequest.onHeadersReceived(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const responseHeaders = { ...(details.responseHeaders ?? {}) };
      for (const key of Object.keys(responseHeaders)) {
        if (key.toLowerCase() === "content-security-policy") {
          delete responseHeaders[key];
        }
      }
      responseHeaders["Content-Security-Policy"] = [AgentWebAgentContentSecurityPolicy];
      callback({ responseHeaders });
    }
  );
  return webSession;
}

// ========== UA 生成 ==========

function createBrowserUserAgent(): string {
  const chromeVersion = process.versions.chrome ?? "120.0.0.0";
  let platform: string;
  switch (process.platform) {
    case "win32":
      platform = "Windows NT 10.0; Win64; x64";
      break;
    case "darwin":
      platform = "Macintosh; Intel Mac OS X 10_15_7";
      break;
    default:
      platform = "X11; Linux x86_64";
      break;
  }
  return [
    `Mozilla/5.0 (${platform})`,
    "AppleWebKit/537.36",
    "(KHTML, like Gecko)",
    `Chrome/${chromeVersion}`,
    "Safari/537.36"
  ].join(" ");
}

// ========== 超时 & 取消 ==========

async function loadURLWithTimeout(
  win: BrowserWindow,
  url: string,
  signal?: AbortSignal
): Promise<void> {
  await runWithTimeout(win.loadURL(url), WebAgentLoadTimeoutMs, signal, "网页加载超时", () => {
    if (!win.isDestroyed()) win.webContents.stop();
  });
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal: undefined | AbortSignal,
  timeoutMessage: string,
  onCancel?: () => void
): Promise<T> {
  if (signal?.aborted) throw createAbortError();
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const settle = (cb: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      cb();
    };
    const abort = () => {
      onCancel?.();
      settle(() => reject(createAbortError()));
    };
    const timeout = setTimeout(() => {
      onCancel?.();
      settle(() => reject(new WebBrowserTimeoutError(timeoutMessage)));
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    promise.then(
      (v) => settle(() => resolve(v)),
      (e) => settle(() => reject(e))
    );
  });
}

// ========== DOM 提取脚本（注入 Renderer，不能引用外部变量） ==========

function createExtractPageScript(mode: AgentWebBrowserMode, maxChars: number): string {
  return `(${extractPageInRenderer.toString()})(${JSON.stringify({ mode, maxChars })})`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ========== 以下函数通过 toString() 注入 Renderer ==========

async function extractPageInRenderer(config: { maxChars: number; mode: "open" | "search" }) {
  const document = globalThis.document;

  // ------- 等待 DOM 稳定 -------
  function waitForDOMStable(): Promise<void> {
    return new Promise((resolve) => {
      let finished = false;
      let quietTimer: undefined | ReturnType<typeof setTimeout>;
      const finish = () => {
        if (finished) return;
        finished = true;
        if (quietTimer) clearTimeout(quietTimer);
        clearTimeout(maxTimer);
        observer.disconnect();
        resolve();
      };
      const resetQuietTimer = () => {
        if (quietTimer) clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, 450);
      };
      const observer = new MutationObserver(resetQuietTimer);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      quietTimer = setTimeout(finish, 450);
      const maxTimer = setTimeout(finish, 2500);
    });
  }

  await waitForDOMStable();

  const title = String(document.title ?? "")
    .replace(/\s+/g, " ")
    .trim();

  const description = String(
    document
      .querySelector('meta[name="description"],meta[property="og:description"]')
      ?.getAttribute("content") ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();

  // ------- 选择内容根节点 -------
  function selectContentRoot(mode: "open" | "search"): HTMLElement {
    const selectors =
      mode === "search"
        ? ["#b_results", "#links", ".results", ".serp__results", "main", '[role="main"]']
        : [
            "article",
            "main",
            '[role="main"]',
            "#content",
            "#main-content",
            ".article",
            ".post-content",
            ".entry-content",
            ".content"
          ];
    const candidates = new Set<Element>();
    for (const sel of selectors) {
      for (const el of document.querySelectorAll(sel)) candidates.add(el);
    }
    let best: Element | undefined;
    let bestScore = 0;
    for (const el of candidates) {
      const textLen = String(el.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim().length;
      const linkCount = el.querySelectorAll("a[href]").length;
      const headingCount = el.querySelectorAll("h1,h2,h3,h4,h5,h6").length;
      const score = textLen + linkCount * 50 + headingCount * 100;
      if (score > bestScore) {
        best = el;
        bestScore = score;
      }
    }
    if (!best) return document.body;
    const textLen = String(best.textContent ?? "")
      .replace(/\s+/g, " ")
      .trim().length;
    const linkCount = best.querySelectorAll("a[href]").length;
    if (mode === "search" && linkCount < 2) return document.body;
    if (mode === "open" && textLen < 400) return document.body;
    return best as HTMLElement;
  }

  const sourceRoot = selectContentRoot(config.mode);
  const root = sourceRoot.cloneNode(true) as Element;

  // ------- 删除无用元素 -------
  function removeSelectors(rootEl: Element, sels: string[]) {
    for (const sel of sels) {
      for (const el of Array.from(rootEl.querySelectorAll(sel))) el.remove();
    }
  }

  removeSelectors(root, [
    "script",
    "style",
    "noscript",
    "template",
    "canvas",
    "svg",
    "iframe",
    "frame",
    "object",
    "embed",
    "video",
    "audio",
    "source",
    "picture",
    "form",
    "input",
    "textarea",
    "select",
    "button"
  ]);

  if (config.mode === "open") {
    removeSelectors(root, [
      "nav",
      "footer",
      "aside",
      '[role="navigation"]',
      '[role="banner"]',
      '[role="complementary"]',
      '[role="dialog"]'
    ]);
  } else {
    removeSelectors(root, ['[role="dialog"]', '[aria-modal="true"]']);
  }

  // ------- 删除隐藏元素 -------
  function removeHiddenElements(rootEl: Element) {
    for (const el of Array.from(rootEl.querySelectorAll("*"))) {
      const hidden = el.hasAttribute("hidden") || el.getAttribute("aria-hidden") === "true";
      const style = String(el.getAttribute("style") ?? "").toLowerCase();
      const hiddenByStyle =
        /display\s*:\s*none/.test(style) || /visibility\s*:\s*hidden/.test(style);
      if (hidden || hiddenByStyle) el.remove();
    }
  }
  removeHiddenElements(root);

  // ------- 删除噪音元素 -------
  function removeNoiseElements(rootEl: Element, mode: "open" | "search") {
    const commonNoise =
      /(?:^|[\s_-])(cookie|consent|advert|advertisement|ads?|sponsor|promotion|newsletter|modal|popup|toast)(?:$|[\s_-])/i;
    const articleNoise =
      /(?:^|[\s_-])(social|share|sidebar|related|recommended|login|sign-?up|subscription)(?:$|[\s_-])/i;
    for (const el of Array.from(rootEl.querySelectorAll("*"))) {
      const sig = [el.getAttribute("id") ?? "", el.getAttribute("class") ?? ""].join(" ");
      if (commonNoise.test(sig) || (mode === "open" && articleNoise.test(sig))) el.remove();
    }
  }
  removeNoiseElements(root, config.mode);

  // ------- 替换图片为 alt -------
  function replaceImagesWithAlt(rootEl: Element) {
    for (const img of Array.from(rootEl.querySelectorAll("img"))) {
      const alt = String(img.getAttribute("alt") ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!alt) {
        img.remove();
        continue;
      }
      const span = document.createElement("span");
      span.textContent = `[图片：${alt}]`;
      img.replaceWith(span);
    }
  }
  replaceImagesWithAlt(root);

  // ------- 规范化链接 -------
  function normalizeLinks(rootEl: Element) {
    let linkID = 0;
    for (const a of Array.from(rootEl.querySelectorAll("a[href]"))) {
      const rawHref = a.getAttribute("href")?.trim();
      if (!rawHref) {
        a.removeAttribute("href");
        continue;
      }
      try {
        let target = new URL(rawHref, document.baseURI);
        if (target.hostname.endsWith("duckduckgo.com") && target.pathname.startsWith("/l/")) {
          const redirected = target.searchParams.get("uddg");
          if (redirected) target = new URL(redirected);
        }
        if (target.protocol !== "http:" && target.protocol !== "https:") {
          a.removeAttribute("href");
          continue;
        }
        linkID += 1;
        a.setAttribute("href", target.toString());
        a.setAttribute("data-link-id", String(linkID));
      } catch {
        a.removeAttribute("href");
      }
    }
  }
  normalizeLinks(root);

  // ------- 剥离属性 -------
  function stripAttributes(rootEl: Element) {
    const globalAttrs = new Set(["title", "aria-label"]);
    const tagAttrs: Record<string, Set<string>> = {
      a: new Set(["href", "data-link-id"]),
      time: new Set(["datetime"]),
      td: new Set(["colspan", "rowspan"]),
      th: new Set(["colspan", "rowspan"])
    };
    for (const el of [rootEl, ...Array.from(rootEl.querySelectorAll("*"))]) {
      const tag = el.tagName.toLowerCase();
      const allowed = tagAttrs[tag] ?? new Set<string>();
      for (const attr of Array.from(el.attributes)) {
        if (globalAttrs.has(attr.name) || allowed.has(attr.name)) continue;
        el.removeAttribute(attr.name);
      }
    }
  }
  stripAttributes(root);

  // ------- 规范化文本节点 -------
  function normalizeTextNodes(rootEl: Element) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let n: Node | null;
    while ((n = walker.nextNode())) nodes.push(n as Text);
    for (const tn of nodes) {
      const parent = tn.parentElement;
      if (parent?.closest("pre, code")) {
        tn.data = tn.data.replace(/[\u200B-\u200D\uFEFF]/g, "").trimEnd();
        continue;
      }
      tn.data = tn.data.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ");
      if (!tn.data.trim()) tn.remove();
    }
  }
  normalizeTextNodes(root);

  // ------- 删除空元素 -------
  function removeEmptyElements(rootEl: Element) {
    const preserved = new Set([
      "br",
      "hr",
      "html",
      "head",
      "body",
      "table",
      "thead",
      "tbody",
      "tr",
      "ul",
      "ol"
    ]);
    for (let round = 0; round < 3; round++) {
      for (const el of Array.from(rootEl.querySelectorAll("*")).reverse()) {
        if (preserved.has(el.tagName.toLowerCase())) continue;
        if (!el.textContent?.trim() && el.children.length === 0) el.remove();
      }
    }
  }
  removeEmptyElements(root);

  // ------- 构建输出文档 -------
  const outputDoc = document.implementation.createHTMLDocument(title);
  outputDoc.head.replaceChildren();
  const metaCharset = outputDoc.createElement("meta");
  metaCharset.setAttribute("charset", "utf-8");
  outputDoc.head.append(metaCharset);
  const titleEl = outputDoc.createElement("title");
  titleEl.textContent = title;
  outputDoc.head.append(titleEl);
  if (description) {
    const descEl = outputDoc.createElement("meta");
    descEl.setAttribute("name", "description");
    descEl.setAttribute("content", description);
    outputDoc.head.append(descEl);
  }
  const lang = document.documentElement.getAttribute("lang")?.trim();
  if (lang) outputDoc.documentElement.setAttribute("lang", lang);
  outputDoc.body.replaceChildren();
  if (sourceRoot.tagName.toLowerCase() === "body") {
    while (root.firstChild) outputDoc.body.append(root.firstChild);
  } else {
    outputDoc.body.append(root);
  }

  const doctype = "<!DOCTYPE html>\n";
  const fullContent = doctype + outputDoc.documentElement.outerHTML;
  const linkCount = outputDoc.querySelectorAll("a[href]").length;
  const results = collectSearchResults(outputDoc, config.mode);

  function collectSearchResults(doc: Document, mode: "open" | "search") {
    if (mode !== "search") return [];

    const seen = new Set<string>();
    const items: Array<{ url: string; title: string; domain: string; snippet: string }> = [];
    for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
      if (items.length >= 10) break;
      const href = anchor.getAttribute("href")?.trim();
      const title = String(anchor.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!href || title.length < 2 || seen.has(href)) continue;

      try {
        const target = new URL(href);
        const domain = target.hostname.replace(/^www\./, "");
        if (!domain || /^(bing|duckduckgo)\.com$/i.test(domain)) continue;

        const container = anchor.closest("li, article, section, div");
        const containerText = String(container?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const snippet = containerText.startsWith(title)
          ? containerText.slice(title.length).trim().slice(0, 240)
          : containerText.slice(0, 240);

        seen.add(href);
        items.push({
          url: href,
          domain,
          snippet,
          title: title.slice(0, 240)
        });
      } catch {
        continue;
      }
    }
    return items;
  }

  if (fullContent.length <= config.maxChars) {
    return {
      title,
      content: fullContent,
      truncated: false,
      originalChars: fullContent.length,
      contentChars: fullContent.length,
      linkCount,
      results
    };
  }

  // ------- 预算裁剪 -------
  function escapeText(v: string): string {
    return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttribute(v: string): string {
    return escapeText(v).replace(/"/g, "&quot;");
  }
  function fitEscapedText(value: string, maxLen: number): string {
    let low = 0,
      high = value.length,
      result = "";
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const cand = escapeText(value.slice(0, mid));
      if (cand.length <= maxLen) {
        result = cand;
        low = mid + 1;
      } else high = mid - 1;
    }
    return result;
  }
  function serializeNodeWithinBudget(
    node: Node,
    state: { remaining: number; truncated: boolean }
  ): string {
    if (node.nodeType === Node.TEXT_NODE) {
      const v = node.textContent ?? "";
      const escaped = escapeText(v);
      if (escaped.length <= state.remaining) {
        state.remaining -= escaped.length;
        return escaped;
      }
      const fitted = fitEscapedText(v, state.remaining);
      state.remaining -= fitted.length;
      state.truncated = true;
      return fitted;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
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
      "param",
      "source",
      "track",
      "wbr"
    ]);
    const attrs = Array.from(el.attributes)
      .map((a) => ` ${a.name}="${escapeAttribute(a.value)}"`)
      .join("");
    const opening = `<${tag}${attrs}>`;
    const closing = voidTags.has(tag) ? "" : `</${tag}>`;
    if (opening.length + closing.length > state.remaining) {
      state.truncated = true;
      return "";
    }
    state.remaining -= opening.length + closing.length;
    let children = "";
    for (const child of Array.from(el.childNodes)) {
      children += serializeNodeWithinBudget(child, state);
      if (state.truncated) break;
    }
    return opening + children + closing;
  }

  const state = { remaining: config.maxChars - doctype.length, truncated: false };
  const serialized = serializeNodeWithinBudget(outputDoc.documentElement, state);
  return {
    title,
    content: doctype + serialized,
    truncated: true,
    originalChars: fullContent.length,
    contentChars: (doctype + serialized).length,
    linkCount,
    results
  };
}
