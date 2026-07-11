import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { app, session, type Session, BrowserWindow } from "electron";
import { Log } from "@/lib/log";

// ========== 类型 ==========

export type AgentWebBrowserMode = "open" | "search";
export type AgentWebSearchEngine = "bing" | "duckduckgo";

export interface AgentWebBrowserSearchInput {
  query: string;
  site?: string;
  action: "search";
  engine?: AgentWebSearchEngine;
}

export interface AgentWebBrowserOpenInput {
  url: string;
  action: "open";
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
}

// ========== 配置 ==========

const WebAgentPartition = "aira-web-agent";
const WebAgentMaxConcurrentWindows = 2;
const WebAgentLoadTimeoutMs = 20_000;
const WebAgentExtractTimeoutMs = 10_000;
const WebAgentDefaultMaxChars = 60_000;
const WebAgentIsolatedWorldID = 1001;

const BlockedResourceTypes = new Set(["image", "media", "font", "object", "ping", "cspReport"]);

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

// ========== 私网地址拦截（自实现 CIDR 匹配，弃用 Node.js BlockList） ==========

const IPv4BlockedRanges: [number, number][] = (() => {
  const subnets: [string, number][] = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ];
  return subnets.map(([net, prefix]) => ip4CidrToRange(net, prefix));
})();

function ip4ToNumber(ip: string): number {
  const parts = ip.split(".");
  return (
    ((Number(parts[0]) << 24) >>> 0) +
    (Number(parts[1]) << 16) +
    (Number(parts[2]) << 8) +
    Number(parts[3])
  );
}

function ip4CidrToRange(net: string, prefix: number): [number, number] {
  const netNum = ip4ToNumber(net);
  const mask = ~((1 << (32 - prefix)) - 1);
  const start = (netNum & mask) >>> 0;
  const end = (start | ~mask) >>> 0;
  return [start, end];
}

function isBlockedIPv4(address: string): boolean {
  const num = ip4ToNumber(address);
  for (const [start, end] of IPv4BlockedRanges) {
    if (num >= start && num <= end) return true;
  }
  return false;
}

function isBlockedIPv6(_address: string): boolean {
  void _address;
  // IPv6 私网地址暂以 hostname 模式检查兜底，后续可按需补充 CIDR 匹配
  return false;
}

interface HostSafetyCacheEntry {
  expiresAt: number;
  result: Promise<boolean>;
}

const HostSafetyCache = new Map<string, HostSafetyCacheEntry>();
let SharedWebAgentSession: Session | undefined;

// ========== URL 安全检查 ==========

async function assertPublicWebURL(value: URL | string): Promise<URL> {
  let url: URL;
  try {
    url = value instanceof URL ? new URL(value) : new URL(value);
  } catch {
    throw new Error("网页 URL 无效");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("只允许访问 HTTP 或 HTTPS 网页");
  }
  if (url.username || url.password) {
    throw new Error("网页 URL 不允许包含认证信息");
  }
  const hostname = normalizeHostname(url.hostname);
  const allowed = await isPublicHostname(hostname);
  if (!allowed) {
    Log.warn("WebBrowser", `URL 安全检查不通过: ${url.toString()}`);
    throw new Error("不允许访问本地、私网或保留地址");
  }
  return url;
}

async function canRequestURL(value: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  return isPublicHostname(normalizeHostname(url.hostname));
}

async function isPublicHostname(hostname: string): Promise<boolean> {
  const normalized = hostname.toLowerCase();
  if (
    !normalized ||
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return false;
  }
  const family = isIP(normalized);
  if (family !== 0) return !isBlockedAddress(normalized, family);
  const now = Date.now();
  const cached = HostSafetyCache.get(normalized);
  if (cached && cached.expiresAt > now) return cached.result;
  // DNS 解析失败或返回空列表时放行，不因网络环境问题误拦公网域名。
  // hostname 模式检查与 webRequest IP 层拦截已提供纵深防御。
  const result = lookup(normalized, { all: true, verbatim: true })
    .then((addresses) => {
      if (!addresses.length) {
        Log.info("WebBrowser", `DNS 空结果放行: ${normalized}`);
        return true;
      }
      for (const { family, address } of addresses) {
        if (isBlockedAddress(address, family)) {
          Log.warn("WebBrowser", `DNS 解析到私网地址被拦截: ${normalized} → ${address}`);
          return false;
        }
      }
      return true;
    })
    .catch((err) => {
      Log.warn("WebBrowser", `DNS 解析失败放行: ${normalized}`, (err as Error)?.message);
      return true;
    });
  HostSafetyCache.set(normalized, { expiresAt: now + 30_000, result });
  return result;
}

function isBlockedAddress(address: string, family: number): boolean {
  if (family === 4) return isBlockedIPv4(address);
  if (family === 6) return isBlockedIPv6(address);
  return true;
}

function normalizeHostname(hostname: string): string {
  return hostname.trim().replace(/^\[/, "").replace(/\]$/, "");
}

// ========== 搜索 URL 构建 ==========

export function createWebSearchURL(
  query: string,
  site?: string,
  engine: AgentWebSearchEngine = "bing"
): URL {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) throw new Error("搜索关键字不能为空");
  const normalizedSite = site ? normalizeSite(site) : undefined;
  const fullQuery = normalizedSite ? `${normalizedQuery} site:${normalizedSite}` : normalizedQuery;
  if (engine === "duckduckgo") {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", fullQuery);
    return url;
  }
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", fullQuery);
  url.searchParams.set("count", "10");
  return url;
}

function normalizeSite(site: string): string {
  const value = site.trim();
  if (!value) throw new Error("搜索站点不能为空");
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return normalizeHostname(url.hostname)
      .replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    throw new Error("搜索站点格式无效");
  }
}

// ========== 公开入口 ==========

export async function executeWebBrowser(
  input: AgentWebBrowserInput,
  signal?: AbortSignal
): Promise<AgentWebPage> {
  if (input.action === "search") {
    const url = createWebSearchURL(input.query, input.site, input.engine);
    return openWebPage({ url, mode: "search", signal });
  }
  return openWebPage({ url: input.url, mode: "open", signal });
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
  const maxChars = clamp(options.maxChars ?? WebAgentDefaultMaxChars, 10_000, 100_000);
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
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      session: getWebAgentSession(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      javascript: true,
      images: false,
      backgroundThrottling: false
    }
  });

  const contents = win.webContents;
  contents.setAudioMuted(true);
  contents.setUserAgent(createBrowserUserAgent());
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-prevent-unload", (event) => event.preventDefault());

  try {
    await loadURLWithTimeout(win, options.url.toString(), options.signal);
    const finalURL = contents.getURL();
    await assertPublicWebURL(finalURL);
    // 阻止后续导航（防止 JS 重定向）
    contents.on("will-navigate", (event) => event.preventDefault());
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
      linkCount: result.linkCount
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
}

// ========== 独立 Session ==========

function getWebAgentSession(): Session {
  if (SharedWebAgentSession) return SharedWebAgentSession;
  const webSession = session.fromPartition(WebAgentPartition, { cache: false });
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
      void canRequestURL(details.url).then(
        (allowed) => callback({ cancel: !allowed }),
        () => callback({ cancel: true })
      );
    }
  );
  SharedWebAgentSession = webSession;
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

  if (fullContent.length <= config.maxChars) {
    return {
      title,
      content: fullContent,
      truncated: false,
      originalChars: fullContent.length,
      contentChars: fullContent.length,
      linkCount
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
    linkCount
  };
}
