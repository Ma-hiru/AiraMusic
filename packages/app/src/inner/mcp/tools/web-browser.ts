import { app, session, type Session, BrowserWindow } from "electron";

import { getAgentWebSafeProxyURL } from "./web-safe-proxy";
import type { AgentWebSearchScope, AgentWebSearchEngine } from "./web-search";
import { assertPublicWebURL, canRequestPublicWebURL } from "./web-url-safety";
import {
  isBingSearchURL,
  queryHasCjkScript,
  createWebSearchURL,
  resolveSearchEngineOrder,
  listAcgRecoverySearchURLs,
  resolveAgentWebSearchScope
} from "./web-search";

export type { AgentWebSearchScope, AgentWebSearchEngine } from "./web-search";
export {
  isBingSearchURL,
  queryHasCjkScript,
  createWebSearchURL,
  resolveSearchEngineOrder,
  AgentWebSearchScopeValues,
  listAcgRecoverySearchURLs,
  createAcgRecoverySearchURL,
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
  /** 首屏加载超时（毫秒）；慢站可提高。 */
  timeoutMs?: number;
}

export interface AgentWebBrowserOpenInput {
  url: string;
  action: "open";
  cursor?: number;
  maxChars?: number;
  /** 首屏加载超时（毫秒）；慢站可提高。 */
  timeoutMs?: number;
}

export interface AgentWebBrowserFindInput {
  url: string;
  action: "find";
  pattern: string;
  matchOffset?: number;
  contextChars?: number;
  /** 首屏加载超时（毫秒）；慢站可提高。 */
  timeoutMs?: number;
}

export interface AgentWebBrowserLoadTimeouts {
  fullLoadTimeoutMs: number;
  firstPaintTimeoutMs: number;
}

export type AgentWebBrowserInput =
  | AgentWebBrowserFindInput
  | AgentWebBrowserOpenInput
  | AgentWebBrowserSearchInput;

export interface AgentWebPage {
  url: string;
  title: string;
  author?: string;
  content: string;
  fetchedAt: string;
  linkCount: number;
  truncated: boolean;
  contentChars: number;
  publishedAt?: string;
  originalChars: number;
  find?: AgentWebFindResult;
  search?: AgentWebSearchContext;
  results?: AgentWebSearchResult[];
  contentRange?: AgentWebContentRange;
}

export interface AgentWebFindResult {
  offset: number;
  pattern: string;
  hasMore: boolean;
  nextOffset?: number;
  sourceChars: number;
  totalMatches: number;
  matches: AgentWebFindMatch[];
}

export interface AgentWebFindMatch {
  end: number;
  start: number;
  snippet: string;
  openCursor: number;
}

export interface AgentWebContentRange {
  end: number;
  start: number;
  total: number;
  hasMore: boolean;
  nextCursor?: number;
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

export const AgentWebPageMaxSerializedChars = 12_000;

const WebSearchStructuredContent =
  "搜索结果已整理到 results 字段；请从 results[].url 选择最相关的页面并使用 open 阅读正文。";
const WebSearchEmptyContent =
  "未能从搜索结果页提取到结构化条目（results 为空）。常见原因：搜索引擎反爬降级页、网络限制，或查询无命中。可改用 engine=baidu、缩小到 encyclopedia/moegirl，或直接 open 已知可信 URL；不要把本页导航/热门链接当作搜索命中。";
const WebPageBudgetTruncationMarker = "\n\n[内容已按 Agent 12K 输出预算截断]";
const ExtractedContentTruncationMarker = "\n\n[正文已截断，可提高 maxChars 后重新 open]";

/**
 * 搜索页已经提取出标题、摘要和目标 URL 后，不再把同一批结果的 HTML 重复交给模型。
 * 若提取器没有得到结构化结果，也不回传反爬/导航页 HTML，避免模型误读为命中。
 */
export function projectAgentWebSearchPage(page: AgentWebPage): AgentWebPage {
  if (!page.results?.length) {
    return {
      ...page,
      content: WebSearchEmptyContent,
      contentChars: WebSearchEmptyContent.length,
      truncated: false
    };
  }

  return {
    ...page,
    content: WebSearchStructuredContent,
    contentChars: WebSearchStructuredContent.length,
    // 搜索页样板被结构化投影主动省略，不代表 results 本身不完整。
    truncated: false
  };
}

/** 合并两个搜索引擎的结构化结果，主引擎保持优先，并按规范化 URL 去重。 */
export function mergeAgentWebSearchPages(
  primary: AgentWebPage,
  fallback: AgentWebPage
): AgentWebPage {
  const results: AgentWebSearchResult[] = [];
  const seen = new Set<string>();
  for (const result of [...(primary.results ?? []), ...(fallback.results ?? [])]) {
    const key = canonicalSearchResultURL(result.url);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    results.push(result);
    if (results.length >= 10) break;
  }
  const primaryCount = primary.results?.length ?? 0;
  const fallbackCount = fallback.results?.length ?? 0;
  // 元数据（尤其最终 url）优先保留真正产出结果的引擎；主引擎有结果时不因备用更多而改挂 URL。
  const base = primaryCount > 0 ? primary : fallbackCount > 0 ? fallback : primary;
  return {
    ...base,
    linkCount: results.length || primary.linkCount + fallback.linkCount,
    originalChars: primary.originalChars + fallback.originalChars,
    ...(results.length ? { results } : {})
  };
}

/** 固定站点搜索只保留目标域名，避免搜索引擎用站外结果凑满数量。 */
export function filterAgentWebSearchPageByDomains(
  page: AgentWebPage,
  domains: readonly string[]
): AgentWebPage {
  if (!domains.length || !page.results?.length) return page;
  const normalizedDomains = domains.map((domain) => domain.toLowerCase().replace(/^www\./, ""));
  const results = page.results.filter((result) => {
    const domain = result.domain.toLowerCase().replace(/^www\./, "");
    return normalizedDomains.some(
      (expected) => domain === expected || domain.endsWith(`.${expected}`)
    );
  });
  return {
    ...page,
    results,
    linkCount: results.length,
    truncated: page.truncated || results.length < page.results.length
  };
}

/** 从查询里抽出可用于相关性判断的 token（拉丁词 + 日/中文片段）。 */
export function tokenizeSearchQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return [];
  const tokens = new Set<string>();
  for (const match of normalized.match(/[a-z0-9]{3,}/g) ?? []) tokens.add(match);
  for (const match of normalized.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? []) {
    tokens.add(match);
    if (match.length > 3) {
      for (let index = 0; index <= match.length - 2; index += 1) {
        tokens.add(match.slice(index, index + 2));
      }
    }
  }
  return [...tokens];
}

/** 主实体词：不做中日文 bigram 展开，避免「初音」单独放宽整页相关性。 */
export function tokenizePrimarySearchQuery(query: string): string[] {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return [];
  const tokens = new Set<string>();
  for (const match of normalized.match(/[a-z0-9]{3,}/g) ?? []) tokens.add(match);
  for (const match of normalized.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? []) {
    tokens.add(match);
  }
  return [...tokens];
}

function resultMatchesSearchToken(result: AgentWebSearchResult, token: string): boolean {
  const haystack =
    `${result.title}\n${result.snippet}\n${result.url}\n${result.domain}`.toLowerCase();
  return haystack.includes(token);
}

function longestToken(tokens: readonly string[]): string {
  return tokens.reduce((longest, token) => (token.length > longest.length ? token : longest), "");
}

/**
 * 判定搜索页是否与 query 相关。
 * Bing 反爬降级页常带完整 b_algo 结构，但标题/摘要与关键词零重合——不能当可用结果。
 * 必须先命中最长主实体词（如 ポリスピカデリー / Polyspicadelly），不能只靠「初音」「eleven」。
 */
export function isRelevantAgentWebSearchPage(
  query: string,
  page: Undefinable<AgentWebPage>
): boolean {
  const results = page?.results;
  if (!results?.length) return false;
  const primary = tokenizePrimarySearchQuery(query);
  if (!primary.length) return true;
  const cjkPrimary = primary.filter((token) => /[\u3040-\u30ff\u3400-\u9fff]/.test(token));
  const latinPrimary = primary.filter((token) => /^[a-z0-9]+$/i.test(token) && token.length >= 5);
  const longestCjk = longestToken(cjkPrimary);
  const longestLatin = longestToken(latinPrimary);
  if (longestCjk.length >= 3) {
    if (!results.some((result) => resultMatchesSearchToken(result, longestCjk))) return false;
  } else if (longestLatin) {
    if (!results.some((result) => resultMatchesSearchToken(result, longestLatin))) return false;
  }
  const tokens = tokenizeSearchQuery(query);
  const hits = results.filter((result) =>
    tokens.some((token) => resultMatchesSearchToken(result, token))
  );
  if (hits.length >= Math.min(2, results.length)) return true;
  return hits.length / results.length >= 0.34;
}

/** 去掉只命中弱词（如单独「初音」）的噪声结果，保留命中最长主词的条目。 */
export function filterAgentWebSearchResultsByQuery(
  query: string,
  results: readonly AgentWebSearchResult[]
): AgentWebSearchResult[] {
  if (!results.length) return [];
  const primary = tokenizePrimarySearchQuery(query);
  if (!primary.length) return [...results];
  const ranked = [...primary].sort((left, right) => right.length - left.length);
  const keys = ranked.slice(0, Math.min(2, ranked.length)).filter((token) => token.length >= 3);
  if (!keys.length) return [...results];
  const filtered = results.filter((result) =>
    keys.some((token) => resultMatchesSearchToken(result, token))
  );
  return filtered.length ? filtered : [...results];
}

function countUsableSearchResults(
  page: Undefinable<AgentWebPage>,
  query: string,
  domains: readonly string[]
): number {
  if (!page?.results?.length) return 0;
  const scoped = filterAgentWebSearchPageByDomains(page, domains);
  const pruned = filterAgentWebSearchResultsByQuery(query, scoped.results ?? []);
  const filtered = { ...scoped, results: pruned, linkCount: pruned.length };
  if (!isRelevantAgentWebSearchPage(query, filtered)) return 0;
  return filtered.results?.length ?? 0;
}

/**
 * 模型最终收到的是完整 AgentWebPage JSON，因此正文预算之外还要计算 URL、元数据和搜索结果。
 * 搜索结果优先保留完整 URL：先压缩摘要，再从尾部减少低优先级结果；URL 本身绝不截断。
 */
export function limitAgentWebPageToBudget(page: AgentWebPage): AgentWebPage {
  let projected = cloneAgentWebPage(page);
  if (serializedPageChars(projected) <= AgentWebPageMaxSerializedChars) return projected;

  projected = { ...projected, truncated: true };
  if (projected.results?.length) {
    projected = fitSearchResultsToBudget(projected, AgentWebPageMaxSerializedChars);
    if (serializedPageChars(projected) <= AgentWebPageMaxSerializedChars) return projected;
  }

  projected = fitPageContentToBudget(projected, AgentWebPageMaxSerializedChars);
  if (serializedPageChars(projected) <= AgentWebPageMaxSerializedChars) return projected;

  // 正常入口已限制 URL、标题和搜索参数；这里只为异常重定向等极端输入保留硬边界。
  const fallbackContent = "[网页固定元数据超过 Agent 输出预算，正文与搜索结果已省略]";
  return {
    url: compactPageURL(projected.url),
    title: projected.title.slice(0, 120),
    content: fallbackContent,
    fetchedAt: projected.fetchedAt.slice(0, 64),
    linkCount: projected.linkCount,
    truncated: true,
    contentChars: fallbackContent.length,
    originalChars: projected.originalChars,
    ...(projected.contentRange
      ? {
          contentRange: {
            start: projected.contentRange.start,
            end: projected.contentRange.start,
            total: projected.contentRange.total,
            hasMore: projected.contentRange.start < projected.contentRange.total,
            ...(projected.contentRange.start < projected.contentRange.total
              ? { nextCursor: projected.contentRange.start }
              : {})
          }
        }
      : {})
  };
}

function fitSearchResultsToBudget(page: AgentWebPage, budgetChars: number): AgentWebPage {
  const sourceResults = page.results?.map((result) => ({ ...result })) ?? [];
  if (!sourceResults.length) return page;

  const createCandidate = (results: AgentWebSearchResult[]): AgentWebPage => {
    const { results: _ignored, ...rest } = page;
    void _ignored;
    return results.length ? { ...rest, results, truncated: true } : { ...rest, truncated: true };
  };
  const withSnippetLimit = (maxChars: number) =>
    createCandidate(
      sourceResults.map((result) => ({
        ...result,
        snippet: truncateSearchSnippet(result.snippet, maxChars)
      }))
    );

  const maxSnippetChars = sourceResults.reduce(
    (maximum, result) => Math.max(maximum, result.snippet.length),
    0
  );
  let low = 0;
  let high = maxSnippetChars;
  let best = withSnippetLimit(0);
  if (serializedPageChars(best) <= budgetChars) {
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = withSnippetLimit(middle);
      if (serializedPageChars(candidate) <= budgetChars) {
        best = candidate;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best;
  }

  const retained = sourceResults.map((result) => ({ ...result, snippet: "" }));
  best = createCandidate(retained);
  while (retained.length && serializedPageChars(best) > budgetChars) {
    retained.pop();
    best = createCandidate(retained);
  }
  return best;
}

function fitPageContentToBudget(page: AgentWebPage, budgetChars: number): AgentWebPage {
  const sourceContent = stripTrailingTruncationMarker(page.content);
  const createCandidate = (maxContentChars: number): AgentWebPage => {
    const content = truncateContentAtSemanticBoundary(
      sourceContent,
      maxContentChars,
      page.contentRange ? "" : WebPageBudgetTruncationMarker
    );
    const contentRange = page.contentRange
      ? createFittedContentRange(page.contentRange, content.length)
      : undefined;
    return {
      ...page,
      content,
      truncated: true,
      contentChars: content.length,
      ...(contentRange ? { contentRange } : {})
    };
  };

  let low = 0;
  let high = sourceContent.length;
  let best = createCandidate(0);
  if (serializedPageChars(best) > budgetChars) return best;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = createCandidate(middle);
    if (serializedPageChars(candidate) <= budgetChars) {
      best = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

function stripTrailingTruncationMarker(value: string): string {
  let content = value.trimEnd();
  for (const marker of [ExtractedContentTruncationMarker, WebPageBudgetTruncationMarker]) {
    if (content.endsWith(marker)) content = content.slice(0, -marker.length).trimEnd();
  }
  return content;
}

function truncateContentAtSemanticBoundary(
  value: string,
  maxChars: number,
  marker = WebPageBudgetTruncationMarker
): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= marker.length) return "";

  const available = maxChars - marker.length;
  const prefix = value.slice(0, available);
  const paragraphBoundary = prefix.lastIndexOf("\n\n");
  const lineBoundary = prefix.lastIndexOf("\n");
  const sentenceBoundary = Math.max(
    prefix.lastIndexOf("。"),
    prefix.lastIndexOf("！"),
    prefix.lastIndexOf("？"),
    prefix.lastIndexOf(". ")
  );
  const preferredBoundary = Math.max(paragraphBoundary, lineBoundary, sentenceBoundary);
  const cutAt = preferredBoundary >= available * 0.6 ? preferredBoundary + 1 : available;
  const content = prefix.slice(0, cutAt).trimEnd();
  return content ? `${content}${marker}` : "";
}

function createFittedContentRange(
  source: AgentWebContentRange,
  retainedChars: number
): AgentWebContentRange {
  const end = Math.min(source.end, source.start + retainedChars);
  const hasMore = end < source.total;
  return {
    start: source.start,
    end,
    total: source.total,
    hasMore,
    ...(hasMore ? { nextCursor: end } : {})
  };
}

function truncateSearchSnippet(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 0) return "";
  if (maxChars === 1) return "…";
  return `${value.slice(0, maxChars - 1).trimEnd()}…`;
}

function cloneAgentWebPage(page: AgentWebPage): AgentWebPage {
  return {
    ...page,
    ...(page.search
      ? {
          search: {
            ...page.search,
            domains: [...page.search.domains]
          }
        }
      : {}),
    ...(page.results ? { results: page.results.map((result) => ({ ...result })) } : {}),
    ...(page.find
      ? { find: { ...page.find, matches: page.find.matches.map((match) => ({ ...match })) } }
      : {})
  };
}

function serializedPageChars(page: AgentWebPage): number {
  return JSON.stringify(page).length;
}

function compactPageURL(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function canonicalSearchResultURL(value: string): string | undefined {
  try {
    const url = new URL(value);
    url.hash = "";
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    url.searchParams.sort();
    return url.toString();
  } catch {
    return undefined;
  }
}

// ========== 配置 ==========

const WebAgentStaticPartition = "aira-web-agent-static";
const WebAgentDynamicPartition = "aira-web-agent-dynamic";
const WebAgentMaxConcurrentWindows = 2;
/** 首屏（dom-ready / finish）默认超时；可通过 timeoutMs 覆盖。 */
export const AgentWebBrowserFirstPaintTimeoutMs = 5_000;
export const AgentWebBrowserFirstPaintTimeoutMinMs = 3_000;
export const AgentWebBrowserFirstPaintTimeoutMaxMs = 30_000;
/** 单次导航完整加载默认预算；会随 timeoutMs 同步拉长。 */
export const AgentWebBrowserFullLoadTimeoutMs = 10_000;
/** 整次 search（多引擎/回退）硬预算，防止级联拖到几十秒。 */
export const AgentWebBrowserSearchBudgetMs = 16_000;
/** Bing 首页表单提交后的导航等待；超时则改走直达 SERP。 */
const BingHomepageSearchNavigateTimeoutMs = 4_500;

/** 解析首屏/完整加载预算；timeoutMs 只抬高首屏，完整加载至少为首屏 +5s。 */
export function resolveWebBrowserLoadTimeouts(timeoutMs?: number): AgentWebBrowserLoadTimeouts {
  const firstPaintTimeoutMs = clamp(
    Math.floor(timeoutMs ?? AgentWebBrowserFirstPaintTimeoutMs),
    AgentWebBrowserFirstPaintTimeoutMinMs,
    AgentWebBrowserFirstPaintTimeoutMaxMs
  );
  return {
    firstPaintTimeoutMs,
    fullLoadTimeoutMs: Math.max(AgentWebBrowserFullLoadTimeoutMs, firstPaintTimeoutMs + 5_000)
  };
}
const WebAgentExtractTimeoutMs = 3_000;
const WebAgentSearchHydrateTimeoutMs = 800;
const WebAgentDefaultMaxChars = 8_000;
const WebAgentIsolatedWorldID = 1001;

const BlockedResourceTypes = new Set([
  "image",
  "media",
  "font",
  "object",
  "ping",
  "cspReport",
  "websocket"
]);

/**
 * javascript 必须为 true：Chromium 在 javascript=false 时会禁用整帧 JS 引擎，
 * executeJavaScriptInIsolatedWorld 的 Promise 永远不结算，最终表现为「网页 DOM 提取超时」。
 *
 * 首次静态读取会禁用页面脚本；只有正文为空时才在同样的沙箱和公开网络代理下
 * 启用页面脚本重试，以兼容依赖客户端渲染的百科与新闻页面。
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

let SharedStaticWebAgentSessionPromise: undefined | Promise<Session>;
let SharedDynamicWebAgentSessionPromise: undefined | Promise<Session>;
// ========== URL 安全检查 ==========

// ========== 公开入口 ==========

export async function executeWebBrowser(
  input: AgentWebBrowserInput,
  signal?: AbortSignal
): Promise<AgentWebPage> {
  const loadTimeouts = resolveWebBrowserLoadTimeouts(input.timeoutMs);
  if (input.action === "search") {
    const resolvedScope = resolveAgentWebSearchScope(input.scope, input.site);
    // 国内网络：DDG 常超时；Bing 对部分日文查询反爬；百度噪声多。默认 Bing→百度→DDG。
    const engines = resolveSearchEngineOrder(input.engine ?? "bing");
    const preferAcgRecovery =
      !input.site && resolvedScope.scope === "general" && queryHasCjkScript(input.query);
    const searchStarted = Date.now();
    const searchBudgetMs = Math.max(
      AgentWebBrowserSearchBudgetMs,
      loadTimeouts.fullLoadTimeoutMs + 6_000
    );
    const searchDeadline = searchStarted + searchBudgetMs;
    const canAttemptMore = () => Date.now() < searchDeadline - 1_500;
    let rawPage: undefined | AgentWebPage;
    let firstError: unknown;
    const absorbSearchPage = (page: AgentWebPage, domains: readonly string[]) => {
      const scoped = filterAgentWebSearchPageByDomains(page, domains);
      const prunedResults = filterAgentWebSearchResultsByQuery(input.query, scoped.results ?? []);
      const filtered = {
        ...scoped,
        results: prunedResults,
        linkCount: prunedResults.length
      };
      if (
        !(filtered.results?.length ?? 0) ||
        !isRelevantAgentWebSearchPage(input.query, filtered)
      ) {
        rawPage ??= page;
        return;
      }
      rawPage = countUsableSearchResults(rawPage, input.query, domains)
        ? mergeAgentWebSearchPages(rawPage!, filtered)
        : filtered;
    };
    /** 只打一个高质量站点回退，避免多站串联把 Agent 卡死。 */
    const runAcgRecovery = async () => {
      if (!canAttemptMore()) return;
      const [url] = listAcgRecoverySearchURLs(input.query);
      if (!url) return;
      try {
        absorbSearchPage(await openWebPage({ url, mode: "search", signal, loadTimeouts }), []);
      } catch (error) {
        if (signal?.aborted) throw error;
        firstError ??= error;
      }
    };
    for (const engine of engines) {
      if (countUsableSearchResults(rawPage, input.query, resolvedScope.domains) >= 3) break;
      if (!canAttemptMore()) break;
      // DDG 国内常整页不可达，预算紧张时直接跳过。
      if (engine === "duckduckgo" && Date.now() - searchStarted > 4_000) continue;
      const url = createWebSearchURL(input.query, input.site, engine, input.scope);
      try {
        absorbSearchPage(
          await openWebPage({ url, mode: "search", signal, loadTimeouts }),
          resolvedScope.domains
        );
      } catch (error) {
        if (signal?.aborted) throw error;
        firstError ??= error;
      }
      // Bing 普通检索失败后立刻做单站回退，再考虑百度。
      if (
        engine === "bing" &&
        preferAcgRecovery &&
        countUsableSearchResults(rawPage, input.query, resolvedScope.domains) < 2
      ) {
        await runAcgRecovery();
        if (countUsableSearchResults(rawPage, input.query, []) >= 2) break;
      }
    }
    if (!rawPage) throw firstError ?? new Error("网页搜索没有返回可用页面");
    const scoped = filterAgentWebSearchPageByDomains(rawPage, resolvedScope.domains);
    const prunedResults = filterAgentWebSearchResultsByQuery(input.query, scoped.results ?? []);
    const pruned = { ...scoped, results: prunedResults, linkCount: prunedResults.length };
    const page = projectAgentWebSearchPage(
      isRelevantAgentWebSearchPage(input.query, pruned)
        ? pruned
        : { ...pruned, results: [], linkCount: 0 }
    );
    return limitAgentWebPageToBudget({
      ...page,
      search: {
        query: input.query,
        scope: resolvedScope.scope,
        label: resolvedScope.label,
        domains: resolvedScope.domains,
        ...(resolvedScope.customSite ? { customSite: resolvedScope.customSite } : {})
      }
    });
  }
  return limitAgentWebPageToBudget(
    await openWebPage({
      url: input.url,
      mode: "open",
      signal,
      loadTimeouts,
      ...(input.action === "find"
        ? {
            findPattern: input.pattern,
            findContextChars: input.contextChars,
            findOffset: input.matchOffset
          }
        : {
            maxChars: input.maxChars,
            cursor: input.cursor
          })
    })
  );
}

interface OpenWebPageOptions {
  cursor?: number;
  maxChars?: number;
  url: URL | string;
  findOffset?: number;
  findPattern?: string;
  signal?: AbortSignal;
  findContextChars?: number;
  mode: AgentWebBrowserMode;
  loadTimeouts?: AgentWebBrowserLoadTimeouts;
}

async function openWebPage(options: OpenWebPageOptions): Promise<AgentWebPage> {
  if (!app.isReady()) throw new Error("Electron app 尚未 ready");
  const url = await assertPublicWebURL(options.url);
  const maxChars = clamp(options.maxChars ?? WebAgentDefaultMaxChars, 2_500, 12_000);
  const cursor = Math.max(0, Math.floor(options.cursor ?? 0));
  const loadTimeouts = options.loadTimeouts ?? resolveWebBrowserLoadTimeouts();
  return WebAgentSemaphore.run(async () => {
    const attemptStarted = Date.now();
    const staticPage = await openWebPageInWindow({
      url,
      mode: options.mode,
      maxChars,
      cursor,
      findPattern: options.findPattern,
      findOffset: options.findOffset,
      findContextChars: options.findContextChars,
      signal: options.signal,
      allowPageScripts: false,
      loadTimeouts
    });
    if (options.mode === "search") {
      if ((staticPage.results?.length ?? 0) > 0) return staticPage;
      // DDG 在国内常整页不可达；静态已空时再开动态只会叠加超时，直接换下一引擎。
      if (/(?:^|\.)duckduckgo\.com$/i.test(url.hostname)) return staticPage;
      // 静态已耗掉大半预算则不再开动态会话。
      if (Date.now() - attemptStarted > loadTimeouts.fullLoadTimeoutMs - 2_000) {
        return staticPage;
      }
      // Bing/百度 SERP 偶发依赖脚本；静态读不到时再开动态会话。
      try {
        const dynamicPage = await openWebPageInWindow({
          url,
          mode: "search",
          maxChars,
          cursor,
          signal: options.signal,
          allowPageScripts: true,
          loadTimeouts
        });
        return (dynamicPage.results?.length ?? 0) > 0 ? dynamicPage : staticPage;
      } catch (error) {
        if (options.signal?.aborted) throw error;
        if (isWebBrowserTimeoutError(error) && (staticPage.contentChars > 0 || staticPage.title)) {
          return staticPage;
        }
        return staticPage;
      }
    }
    if (!isLowQualityOpenPage(staticPage)) return staticPage;
    if (Date.now() - attemptStarted > loadTimeouts.fullLoadTimeoutMs - 2_000) {
      if (staticPage.contentChars > 0) return staticPage;
      throw new Error("网页正文为空或过短，站点可能阻止自动读取");
    }

    const dynamicPage = await openWebPageInWindow({
      url,
      mode: options.mode,
      maxChars,
      cursor,
      findPattern: options.findPattern,
      findOffset: options.findOffset,
      findContextChars: options.findContextChars,
      signal: options.signal,
      allowPageScripts: true,
      loadTimeouts
    });
    if (isLowQualityOpenPage(dynamicPage)) {
      if (staticPage.contentChars > 0) return staticPage;
      throw new Error("网页正文为空或过短，站点可能阻止自动读取");
    }
    return dynamicPage;
  }, options.signal);
}

function isLowQualityOpenPage(page: AgentWebPage): boolean {
  const sourceChars = page.find?.sourceChars ?? page.contentRange?.total ?? page.contentChars;
  return sourceChars < 200 || (!page.find && page.content.trim().length < 120);
}

// ========== 隐藏 BrowserWindow ==========

async function openWebPageInWindow(options: {
  url: URL;
  cursor: number;
  maxChars: number;
  findOffset?: number;
  findPattern?: string;
  signal?: AbortSignal;
  allowPageScripts: boolean;
  findContextChars?: number;
  mode: AgentWebBrowserMode;
  loadTimeouts: AgentWebBrowserLoadTimeouts;
}): Promise<AgentWebPage> {
  const webSession = await getWebAgentSession(options.allowPageScripts);
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
  // Electron 29 起该 API 从 Session 移除，只能设在 WebContents 上；
  // 阻止页面通过 WebRTC 绕过固定代理直连泄露真实地址
  contents.setWebRTCIPHandlingPolicy("disable_non_proxied_udp");
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
    await loadSearchOrPageURL(
      win,
      options.url,
      options.mode,
      options.allowPageScripts,
      options.loadTimeouts,
      options.signal
    );
    const finalURL = contents.getURL();
    await assertPublicWebURL(finalURL);
    // 页面载入完成后锁定导航，避免提取期间被脚本切换到另一个文档。
    contents.on("will-navigate", (event) => event.preventDefault());
    contents.on("will-redirect", (event) => event.preventDefault());
    if (options.mode === "search" && options.allowPageScripts) {
      await waitForSearchResultsHydration(contents, options.signal);
    }
    try {
      const result = await runWithTimeout(
        contents.executeJavaScriptInIsolatedWorld(WebAgentIsolatedWorldID, [
          {
            code: createExtractPageScript(
              options.mode,
              options.maxChars,
              options.cursor,
              options.findPattern,
              options.findContextChars,
              options.findOffset
            )
          }
        ]) as Promise<ExtractedPageResult>,
        WebAgentExtractTimeoutMs,
        options.signal,
        "网页 DOM 提取超时"
      );
      return {
        url: finalURL,
        title: result.title,
        ...(result.author ? { author: result.author } : {}),
        ...(result.publishedAt ? { publishedAt: result.publishedAt } : {}),
        content: result.content,
        fetchedAt: new Date().toISOString(),
        truncated: result.truncated,
        originalChars: result.originalChars,
        contentChars: result.contentChars,
        linkCount: result.linkCount,
        ...(result.contentRange ? { contentRange: result.contentRange } : {}),
        ...(result.find ? { find: result.find } : {}),
        ...(result.results.length ? { results: result.results } : {})
      };
    } catch (error) {
      if (options.signal?.aborted) throw error;
      // 完整提取失败时退回原始 DOM/正文，避免整次工具调用卡死无结果。
      return extractRawPageFallback(contents, finalURL, options.maxChars);
    }
  } finally {
    if (!win.isDestroyed()) {
      contents.stop();
      win.destroy();
    }
  }
}

interface ExtractedPageResult {
  title: string;
  author?: string;
  content: string;
  linkCount: number;
  truncated: boolean;
  contentChars: number;
  publishedAt?: string;
  originalChars: number;
  find?: AgentWebFindResult;
  results: AgentWebSearchResult[];
  contentRange?: AgentWebContentRange;
}

// ========== 独立 Session ==========

function getWebAgentSession(allowPageScripts: boolean): Promise<Session> {
  const current = allowPageScripts
    ? SharedDynamicWebAgentSessionPromise
    : SharedStaticWebAgentSessionPromise;
  if (current) return current;

  const created = createWebAgentSession(allowPageScripts).catch((error) => {
    if (allowPageScripts) SharedDynamicWebAgentSessionPromise = undefined;
    else SharedStaticWebAgentSessionPromise = undefined;
    throw error;
  });
  if (allowPageScripts) SharedDynamicWebAgentSessionPromise = created;
  else SharedStaticWebAgentSessionPromise = created;
  return created;
}

async function createWebAgentSession(allowPageScripts: boolean): Promise<Session> {
  const webSession = session.fromPartition(
    allowPageScripts ? WebAgentDynamicPartition : WebAgentStaticPartition,
    { cache: false }
  );
  const safeProxyURL = await getAgentWebSafeProxyURL();
  await webSession.setProxy({
    mode: "fixed_servers",
    proxyRules: safeProxyURL,
    proxyBypassRules: "<-loopback>"
  });
  webSession.setPermissionCheckHandler(() => false);
  webSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  webSession.on("will-download", (event) => event.preventDefault());
  // 对齐 web-search-mcp：en-US Accept-Language，降低被打到 cn.bing 反爬降级页的概率。
  webSession.webRequest.onBeforeSendHeaders(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };
      requestHeaders["Accept-Language"] = "en-US,en;q=0.9";
      requestHeaders["Accept"] =
        requestHeaders["Accept"] ||
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8";
      callback({ requestHeaders });
    }
  );
  webSession.webRequest.onBeforeRequest(
    { urls: ["http://*/*", "https://*/*"] },
    (details, callback) => {
      if (
        BlockedResourceTypes.has(details.resourceType) ||
        (!allowPageScripts && details.resourceType === "script")
      ) {
        callback({ cancel: true });
        return;
      }
      void canRequestPublicWebURL(details.url).then(
        (allowed) => callback({ cancel: !allowed }),
        () => callback({ cancel: true })
      );
    }
  );
  if (!allowPageScripts) {
    // 静态首读覆盖站点 CSP，页面脚本（含内联）一律禁止；隔离世界提取不受影响。
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
  }
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

/**
 * 两阶段加载：
 * - firstPaintTimeoutMs 内必须出现首屏，否则直接超时错误；
 * - fullLoadTimeoutMs 内未完整加载则 stop 并继续用已有 DOM 提取。
 */
async function loadURLWithBudget(
  win: BrowserWindow,
  url: string,
  loadTimeouts: AgentWebBrowserLoadTimeouts,
  signal?: AbortSignal
): Promise<{ completed: boolean }> {
  if (signal?.aborted) throw createAbortError();
  const contents = win.webContents;
  const started = Date.now();
  const firstPaintTimeoutMs = loadTimeouts.firstPaintTimeoutMs;
  const fullLoadTimeoutMs = loadTimeouts.fullLoadTimeoutMs;
  const firstPaintTimeoutLabel = formatTimeoutSeconds(firstPaintTimeoutMs);
  const fullLoadTimeoutLabel = formatTimeoutSeconds(fullLoadTimeoutMs);
  let firstPaint = false;
  let finished = false;
  let loadError: Error | undefined;

  const markFirstPaint = () => {
    firstPaint = true;
  };
  const onFinish = () => {
    finished = true;
    firstPaint = true;
  };
  const onFail = (
    _event: Electron.Event,
    _errorCode: number,
    errorDescription: string,
    _validatedURL: string,
    isMainFrame: boolean
  ) => {
    if (!isMainFrame || finished || firstPaint) return;
    loadError = new Error(`网页加载失败：${errorDescription || "unknown"}`);
  };

  contents.on("dom-ready", markFirstPaint);
  contents.on("did-finish-load", onFinish);
  contents.on("did-fail-load", onFail);

  const loadPromise = win.loadURL(url).then(
    () => {
      finished = true;
      firstPaint = true;
    },
    (error: unknown) => {
      loadError ??= error instanceof Error ? error : new Error(String(error));
    }
  );

  try {
    await runWithTimeout(
      new Promise<void>((resolve, reject) => {
        const tick = () => {
          if (signal?.aborted) {
            reject(createAbortError());
            return;
          }
          if (loadError && !firstPaint) {
            reject(loadError);
            return;
          }
          if (firstPaint || finished) {
            resolve();
            return;
          }
          if (Date.now() - started >= firstPaintTimeoutMs) {
            reject(new WebBrowserTimeoutError(`网页首屏加载超时（${firstPaintTimeoutLabel}）`));
            return;
          }
          setTimeout(tick, 40);
        };
        tick();
      }),
      firstPaintTimeoutMs + 120,
      signal,
      `网页首屏加载超时（${firstPaintTimeoutLabel}）`,
      () => {
        if (!win.isDestroyed()) contents.stop();
      }
    );

    if (finished) {
      await loadPromise.catch(() => undefined);
      return { completed: true };
    }

    const remaining = fullLoadTimeoutMs - (Date.now() - started);
    if (remaining <= 0) {
      if (!win.isDestroyed()) contents.stop();
      return { completed: false };
    }

    try {
      await runWithTimeout(
        loadPromise,
        remaining,
        signal,
        `网页完整加载超时（${fullLoadTimeoutLabel}）`,
        () => {
          if (!win.isDestroyed()) contents.stop();
        }
      );
      return { completed: true };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (isWebBrowserTimeoutError(error)) {
        if (!win.isDestroyed()) contents.stop();
        return { completed: false };
      }
      throw error;
    }
  } finally {
    contents.removeListener("dom-ready", markFirstPaint);
    contents.removeListener("did-finish-load", onFinish);
    contents.removeListener("did-fail-load", onFail);
  }
}

function formatTimeoutSeconds(timeoutMs: number): string {
  const seconds = timeoutMs / 1_000;
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`;
}

/**
 * Bing 加载策略（预算内）：
 * - 静态直达 SERP；空结果由上层再开动态会话。
 * - 动态每次走首页表单（仅 cookie 直达 SERP 仍会被 cn.bing 反爬清空）。
 * - 表单失败再直达带 cvid 的 SERP，避免卡死。
 */
async function loadSearchOrPageURL(
  win: BrowserWindow,
  url: URL,
  mode: AgentWebBrowserMode,
  allowPageScripts: boolean,
  loadTimeouts: AgentWebBrowserLoadTimeouts,
  signal?: AbortSignal
): Promise<void> {
  if (mode !== "search" || !isBingSearchURL(url)) {
    await loadURLWithBudget(win, url.toString(), loadTimeouts, signal);
    return;
  }

  const query = url.searchParams.get("q")?.trim() ?? "";

  // 静态无脚本，无法走首页表单；空结果交给动态会话。
  if (!allowPageScripts || !query) {
    await loadURLWithBudget(win, url.toString(), loadTimeouts, signal);
    return;
  }

  try {
    await loadURLWithBudget(win, "https://www.bing.com/", loadTimeouts, signal);
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  try {
    await submitBingHomepageSearch(win, query, signal);
    if (isBingSearchURL(new URL(win.webContents.getURL()))) return;
  } catch (error) {
    if (signal?.aborted) throw error;
  }

  await loadURLWithBudget(win, url.toString(), loadTimeouts, signal);
}

async function submitBingHomepageSearch(
  win: BrowserWindow,
  query: string,
  signal?: AbortSignal
): Promise<void> {
  const code = `(() => {
    const input =
      document.querySelector("#sb_form_q") ||
      document.querySelector("textarea[name='q']") ||
      document.querySelector("input[name='q']");
    const form = document.querySelector("#sb_form") || input?.closest?.("form");
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) {
      throw new Error("bing_search_form_missing");
    }
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("bing_search_form_missing");
    }
    input.focus();
    input.value = ${JSON.stringify(query)};
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.submit();
    return true;
  })()`;
  await runWithTimeout(
    win.webContents.executeJavaScript(code) as Promise<unknown>,
    1_500,
    signal,
    "Bing 搜索框提交超时"
  );
  await runWithTimeout(
    new Promise<void>((resolve, reject) => {
      const contents = win.webContents;
      const started = Date.now();
      const timer = setTimeout(() => {
        cleanup();
        reject(new WebBrowserTimeoutError("Bing 搜索导航超时"));
      }, BingHomepageSearchNavigateTimeoutMs);
      const onReady = () => {
        try {
          if (isBingSearchURL(new URL(contents.getURL()))) {
            cleanup();
            resolve();
          }
        } catch {
          /* ignore transient URL */
        }
        if (Date.now() - started >= BingHomepageSearchNavigateTimeoutMs) {
          cleanup();
          reject(new WebBrowserTimeoutError("Bing 搜索导航超时"));
        }
      };
      const cleanup = () => {
        clearTimeout(timer);
        contents.removeListener("did-finish-load", onReady);
        contents.removeListener("did-navigate", onReady);
        contents.removeListener("dom-ready", onReady);
      };
      contents.on("did-finish-load", onReady);
      contents.on("did-navigate", onReady);
      contents.on("dom-ready", onReady);
      onReady();
    }),
    BingHomepageSearchNavigateTimeoutMs + 200,
    signal,
    "Bing 搜索导航超时"
  );
}

async function extractRawPageFallback(
  contents: Electron.WebContents,
  finalURL: string,
  maxChars: number
): Promise<AgentWebPage> {
  const limit = Math.max(500, Math.floor(maxChars));
  const code = `(() => {
    const title = String(document.title || "").replace(/\\s+/g, " ").trim().slice(0, 300);
    const text = String(document.body?.innerText || document.documentElement?.outerHTML || "")
      .replace(/\\s+/g, " ")
      .trim();
    const content = text.slice(0, ${limit});
    return {
      title,
      content,
      truncated: text.length > content.length,
      originalChars: text.length,
      contentChars: content.length,
      linkCount: document.querySelectorAll("a[href]").length,
      results: []
    };
  })()`;
  try {
    const result = (await contents.executeJavaScriptInIsolatedWorld(WebAgentIsolatedWorldID, [
      { code }
    ])) as ExtractedPageResult;
    return {
      url: finalURL,
      title: result.title || "未命名页面",
      content: result.content || "[未能提取页面内容]",
      fetchedAt: new Date().toISOString(),
      truncated: Boolean(result.truncated),
      originalChars: result.originalChars ?? 0,
      contentChars: result.contentChars ?? 0,
      linkCount: result.linkCount ?? 0
    };
  } catch {
    const fallback = "[页面加载未完成，原始 DOM 提取失败]";
    return {
      url: finalURL,
      title: "加载未完成",
      content: fallback,
      fetchedAt: new Date().toISOString(),
      truncated: true,
      originalChars: 0,
      contentChars: fallback.length,
      linkCount: 0
    };
  }
}

/** 动态 SERP 在 did-finish-load 后仍可能晚一点才插入主结果节点。 */
async function waitForSearchResultsHydration(
  contents: Electron.WebContents,
  signal?: AbortSignal
): Promise<void> {
  const code = `new Promise((resolve) => {
    const ready = () =>
      !!document.querySelector(
        "#b_results li.b_algo h2 a, .b_algo h2 a, .b_result h2 a, .results .result .result__a, a.result-link, article h2 > a[href], #content_left .result h3 a[href], #content_left .c-container h3 a[href]"
      );
    if (ready()) {
      resolve(true);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (ready() || Date.now() - started >= ${WebAgentSearchHydrateTimeoutMs}) {
        clearInterval(timer);
        resolve(ready());
      }
    }, 120);
  })`;
  try {
    await runWithTimeout(
      contents.executeJavaScriptInIsolatedWorld(WebAgentIsolatedWorldID, [
        { code }
      ]) as Promise<unknown>,
      WebAgentSearchHydrateTimeoutMs + 400,
      signal,
      "搜索结果等待超时"
    );
  } catch (error) {
    if (signal?.aborted) throw error;
  }
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

export function createExtractPageScript(
  mode: AgentWebBrowserMode,
  maxChars: number,
  cursor = 0,
  findPattern?: string,
  findContextChars = 320,
  findOffset = 0
): string {
  // tsup 开启函数名保留时，toString() 结果可能引用构建期的 __name 辅助函数；
  // 把最小兼容实现一并放进隔离世界，避免开发测试可用、打包后提取失败。
  return `(() => { const __name = (value) => value; return (${extractPageInRenderer.toString()})(${JSON.stringify({ mode, maxChars, cursor, findPattern, findContextChars, findOffset })}); })()`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ========== 以下函数通过 toString() 注入 Renderer ==========

async function extractPageInRenderer(config: {
  cursor: number;
  maxChars: number;
  findOffset?: number;
  findPattern?: string;
  mode: "open" | "search";
  findContextChars?: number;
}) {
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
        quietTimer = setTimeout(finish, config.mode === "search" ? 180 : 450);
      };
      const observer = new MutationObserver(resetQuietTimer);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      quietTimer = setTimeout(finish, config.mode === "search" ? 180 : 450);
      const maxTimer = setTimeout(finish, config.mode === "search" ? 700 : 2500);
    });
  }

  await waitForDOMStable();

  const title = String(document.title ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  const description = String(
    document
      .querySelector('meta[name="description"],meta[property="og:description"]')
      ?.getAttribute("content") ?? ""
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  // ------- 在清洗正文前保留署名与发布时间 -------
  function normalizeMetadataText(value: null | string | undefined, maxChars: number): string {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maxChars);
  }

  function firstMetaContent(selectors: readonly string[], maxChars: number): string {
    for (const selector of selectors) {
      const content = normalizeMetadataText(
        document.querySelector(selector)?.getAttribute("content"),
        maxChars
      );
      if (content) return content;
    }
    return "";
  }

  function firstElementText(selectors: readonly string[], maxChars: number): string {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const content =
        element?.getAttribute("content") ??
        element?.getAttribute("datetime") ??
        element?.textContent;
      const normalized = normalizeMetadataText(content, maxChars);
      if (normalized) return normalized;
    }
    return "";
  }

  const author =
    firstMetaContent(
      [
        'meta[name="author"]',
        'meta[property="article:author"]',
        'meta[name="byline"]',
        'meta[name="byl"]'
      ],
      200
    ) ||
    firstElementText(
      [
        '[itemprop~="author"] [itemprop~="name"]',
        'a[rel~="author"]',
        '[itemprop~="author"]',
        '[itemprop~="creator"]',
        ".byline",
        '[class~="byline"]'
      ],
      200
    );

  const publishedAt =
    firstMetaContent(
      [
        'meta[property="article:published_time"]',
        'meta[name="article:published_time"]',
        'meta[itemprop~="datePublished"]',
        'meta[name="date"]',
        'meta[name="publishdate"]',
        'meta[name="pubdate"]'
      ],
      100
    ) || firstElementText(['time[itemprop~="datePublished"]', '[itemprop~="datePublished"]'], 100);

  // ------- 选择内容根节点 -------
  function selectContentRoot(mode: "open" | "search"): HTMLElement {
    const selectors =
      mode === "search"
        ? [
            "#b_results",
            "#content_left",
            "#links",
            ".results",
            ".serp__results",
            "table",
            "main",
            '[role="main"]'
          ]
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
      const linkTextLen = Array.from(el.querySelectorAll("a[href]")).reduce(
        (total, anchor) =>
          total +
          String(anchor.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim().length,
        0
      );
      const paragraphTextLen = Array.from(el.querySelectorAll("p,pre,blockquote")).reduce(
        (total, paragraph) => {
          const length = String(paragraph.textContent ?? "")
            .replace(/\s+/g, " ")
            .trim().length;
          return total + (length >= 25 ? length : 0);
        },
        0
      );
      const score =
        mode === "search"
          ? textLen + linkCount * 50 + headingCount * 100
          : paragraphTextLen * 2 + textLen * 0.25 + headingCount * 40 - linkTextLen * 1.5;
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
  const originalChars = sourceRoot.outerHTML.length;
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
      '[role="navigation"]',
      '[role="banner"]',
      '[role="dialog"]'
    ]);
    // 百科信息框经常使用 aside；只删除正文外侧栏，保留文章内部的结构化资料。
    for (const aside of Array.from(root.querySelectorAll('aside,[role="complementary"]'))) {
      const insideArticle = Boolean(aside.closest("article"));
      const hasStructuredFacts = Boolean(aside.querySelector("table,dl"));
      if (!insideArticle && !hasStructuredFacts) aside.remove();
    }
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
      /(?:^|[\s_-])(cookie|consent|advert(?:isement|ising)?|ads?|sponsor|promotion|newsletter|modal|popup|toast)(?:$|[\s_-])/i;
    const articleNoise =
      /(?:^|[\s_-])(social|share|sidebar|related|recommended|login|sign-?up|subscription|comments?|breadcrumb|pagination|author-?box|read-?more|download-?app|qr-?code)(?:$|[\s_-])/i;
    for (const el of Array.from(rootEl.querySelectorAll("*"))) {
      const sig = [el.getAttribute("id") ?? "", el.getAttribute("class") ?? ""].join(" ");
      const substantialExpandableContent =
        mode === "open" &&
        /(?:^|[\s_-])read-?more(?:$|[\s_-])/i.test(sig) &&
        String(el.textContent ?? "").trim().length >= 300;
      if (
        commonNoise.test(sig) ||
        (mode === "open" && articleNoise.test(sig) && !substantialExpandableContent)
      ) {
        el.remove();
      }
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
        for (const key of Array.from(target.searchParams.keys())) {
          if (/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) {
            target.searchParams.delete(key);
          }
        }
        a.setAttribute("href", target.toString());
      } catch {
        a.removeAttribute("href");
      }
    }
  }
  normalizeLinks(root);

  // 必须在剥离 class/id 前按搜索引擎的语义结构提取主结果。
  const results = collectSearchResults(root, config.mode);

  // ------- 剥离属性 -------
  function stripAttributes(rootEl: Element) {
    const globalAttrs = new Set(["title", "aria-label"]);
    const tagAttrs: Record<string, Set<string>> = {
      a: new Set(["href"]),
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

  const linkCount = root.querySelectorAll("a[href]").length;

  function collectSearchResults(containerRoot: ParentNode, mode: "open" | "search") {
    if (mode !== "search") return [];

    const seen = new Set<string>();
    const items: Array<{ url: string; title: string; domain: string; snippet: string }> = [];
    // 只认搜索引擎主结果节点。反爬/降级页没有这些节点时返回空，
    // 绝不能回退到全页 a[href]，否则会把热门推荐、页脚导航当成命中。
    // Bing 选择器对齐 web-search-mcp：.b_algo / .b_result + h2 a。
    const primarySelectors = [
      "#b_results li.b_algo h2 a[href]",
      ".b_algo h2 a[href]",
      ".b_result h2 a[href]",
      ".results .result .result__a[href]",
      ".result__body .result__a[href]",
      "a.result-link[href]",
      "article[data-testid='result'] h2 a[href]",
      "#content_left .result h3 a[href]",
      "#content_left .c-container h3 a[href]",
      "#content_left h3.t a[href]"
    ];
    const anchors = Array.from(
      containerRoot.querySelectorAll<HTMLAnchorElement>(primarySelectors.join(","))
    );
    function resolveSearchResultURL(href: string): URL | undefined {
      try {
        const raw = new URL(href, String(document.baseURI || location.href));
        // DuckDuckGo HTML 结果是 /l/?uddg=<目标> 跳转链；不解包会被当成引擎域名丢掉。
        if (/(?:^|\.)duckduckgo\.com$/i.test(raw.hostname)) {
          const uddg = raw.searchParams.get("uddg");
          if (!uddg) return undefined;
          return new URL(uddg);
        }
        if (/(?:^|\.)bing\.com$/i.test(raw.hostname)) return undefined;
        // 百度结果常是 /link?url= 加密跳转；保留跳转链供后续 open 跟随，域名用展示 URL 补。
        if (/(?:^|\.)baidu\.com$/i.test(raw.hostname) && !/\/link\b/i.test(raw.pathname)) {
          return undefined;
        }
        return raw;
      } catch {
        return undefined;
      }
    }

    for (const anchor of anchors) {
      if (items.length >= 10) break;
      const href = anchor.getAttribute("href")?.trim();
      const title = String(anchor.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim();
      if (!href || title.length < 2) continue;

      try {
        const target = resolveSearchResultURL(href);
        if (!target) continue;
        const canonicalTarget = new URL(target.toString());
        canonicalTarget.hash = "";
        if (canonicalTarget.pathname.length > 1) {
          canonicalTarget.pathname = canonicalTarget.pathname.replace(/\/+$/, "");
        }
        canonicalTarget.searchParams.sort();
        const canonicalURL = canonicalTarget.toString();
        const row = anchor.closest("tr");
        const container = anchor.closest(
          "li.b_algo,.result,.c-container,.result-op,article,li,section,div,tr"
        );
        let domain = target.hostname.replace(/^www\./, "");
        let openURL = target.toString();
        if (/(?:^|\.)baidu\.com$/i.test(domain)) {
          // 新版百度常把真实落地页放在容器 mu / data-url，展示域名在 c-showurl。
          const landing =
            container?.getAttribute("mu") ||
            container?.getAttribute("data-url") ||
            anchor.getAttribute("data-url") ||
            "";
          if (landing) {
            try {
              const landed = new URL(landing, String(document.baseURI || location.href));
              if (landed.protocol === "http:" || landed.protocol === "https:") {
                openURL = landed.toString();
                domain = landed.hostname.replace(/^www\./, "");
              }
            } catch {
              // 保留百度跳转链，open 时再跟随。
            }
          }
          if (/(?:^|\.)baidu\.com$/i.test(domain)) {
            const showUrl = String(
              container?.querySelector(
                ".c-showurl,.c-color-gray,.cite,.b_attribution,.result__url,[class*='showurl']"
              )?.textContent ?? ""
            )
              .replace(/\s+/g, " ")
              .trim();
            const hostMatch = showUrl.match(/(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/i);
            if (hostMatch?.[1]) domain = hostMatch[1].replace(/^www\./i, "").toLowerCase();
          }
        }
        if (!domain || seen.has(canonicalURL)) continue;

        const containerText = String(container?.textContent ?? "")
          .replace(/\s+/g, " ")
          .trim();
        const semanticSnippet = String(
          (
            container?.querySelector(
              ".b_caption p,.result__snippet,.result-snippet,td.result-snippet,.c-abstract,.content-right_8Zs90,p"
            ) ?? row?.nextElementSibling?.querySelector(".result-snippet,td.result-snippet")
          )?.textContent ?? ""
        )
          .replace(/\s+/g, " ")
          .trim();
        const snippet = (
          semanticSnippet ||
          (containerText.startsWith(title)
            ? containerText.slice(title.length).trim()
            : containerText)
        ).slice(0, 240);

        seen.add(canonicalURL);
        items.push({
          // 规范化 URL 只用于去重；百度结果优先落地页，否则保留跳转链供 open 跟随。
          url: openURL,
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

  // ------- 把正文 DOM 投影为紧凑 Markdown -------
  const markdownBlockTags = new Set([
    "address",
    "article",
    "body",
    "details",
    "div",
    "figcaption",
    "figure",
    "header",
    "main",
    "ol",
    "section",
    "summary",
    "table",
    "tbody",
    "tfoot",
    "thead",
    "ul"
  ]);

  function renderChildren(node: Node): string {
    return Array.from(node.childNodes)
      .map((child) => renderNode(child))
      .join("");
  }

  function renderNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    const children = renderChildren(el);
    const inline = children.replace(/\s+/g, " ").trim();

    if (/^h[1-6]$/.test(tag)) {
      const level = Number(tag.slice(1));
      return inline ? `\n\n${"#".repeat(level)} ${inline}\n\n` : "";
    }
    if (tag === "p") return inline ? `\n\n${inline}\n\n` : "";
    if (tag === "br") return "\n";
    if (tag === "hr") return "\n\n---\n\n";
    if (tag === "a") {
      const href = el.getAttribute("href")?.trim();
      if (!href) return inline;
      const label = inline || el.getAttribute("title")?.trim() || href;
      return `[${label}](${href})`;
    }
    if (tag === "strong" || tag === "b") return inline ? `**${inline}**` : "";
    if (tag === "em" || tag === "i") return inline ? `*${inline}*` : "";
    if (tag === "code" && el.parentElement?.tagName.toLowerCase() !== "pre") {
      return inline ? `\`${inline.replace(/`/g, "\\`")}\`` : "";
    }
    if (tag === "pre") {
      const code = String(el.textContent ?? "").trim();
      return code ? `\n\n\`\`\`\n${code}\n\`\`\`\n\n` : "";
    }
    if (tag === "blockquote") {
      const quoted = normalizeMarkdown(children)
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      return quoted ? `\n\n${quoted}\n\n` : "";
    }
    if (tag === "li") {
      const parent = el.parentElement;
      const ordered = parent?.tagName.toLowerCase() === "ol";
      const siblings = parent
        ? Array.from(parent.children).filter((child) => child.tagName.toLowerCase() === "li")
        : [];
      const index = Math.max(0, siblings.indexOf(el));
      return inline ? `\n${ordered ? `${index + 1}.` : "-"} ${inline}\n` : "";
    }
    if (tag === "tr") {
      const cells = Array.from(el.children)
        .filter((child) => /^(td|th)$/i.test(child.tagName))
        .map((cell) => renderChildren(cell).replace(/\s+/g, " ").trim())
        .filter(Boolean);
      return cells.length ? `\n| ${cells.join(" | ")} |\n` : "";
    }
    if (tag === "dt") return inline ? `\n\n**${inline}**\n` : "";
    if (tag === "dd") return inline ? `\n${inline}\n\n` : "";

    return markdownBlockTags.has(tag) ? `\n${children}\n` : children;
  }

  function normalizeMarkdown(value: string): string {
    const lines: string[] = [];
    let insideFence = false;
    for (const rawLine of value.replace(/\r\n?/g, "\n").split("\n")) {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith("```")) {
        insideFence = !insideFence;
        lines.push(trimmed);
        continue;
      }
      lines.push(insideFence ? rawLine.trimEnd() : rawLine.replace(/[ \t]+/g, " ").trim());
    }
    return lines
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const bodyContent = normalizeMarkdown(renderNode(root));
  const summary = description && !bodyContent.includes(description) ? `> 摘要：${description}` : "";
  const fullContent = normalizeMarkdown([summary, bodyContent].filter(Boolean).join("\n\n"));

  // find 只返回匹配片段和可继续 open 的游标，避免为定位一个词读取整篇网页。
  const findPattern = String(config.findPattern ?? "").trim();
  if (findPattern) {
    const normalizedContent = fullContent.toLocaleLowerCase();
    const normalizedPattern = findPattern.toLocaleLowerCase();
    const contextChars = Math.min(800, Math.max(120, Math.floor(config.findContextChars ?? 320)));
    const offset = Math.max(0, Math.floor(config.findOffset ?? 0));
    const matches: Array<{
      end: number;
      start: number;
      snippet: string;
      openCursor: number;
    }> = [];
    let totalMatches = 0;
    let searchFrom = 0;
    while (searchFrom < normalizedContent.length) {
      const start = normalizedContent.indexOf(normalizedPattern, searchFrom);
      if (start < 0) break;
      const end = start + normalizedPattern.length;
      const matchIndex = totalMatches;
      totalMatches += 1;
      if (matchIndex >= offset && matches.length < 12) {
        const snippetStart = Math.max(0, start - Math.floor(contextChars / 2));
        const snippetEnd = Math.min(fullContent.length, end + Math.ceil(contextChars / 2));
        matches.push({
          start,
          end,
          openCursor: Math.max(0, start - Math.floor(config.maxChars * 0.25)),
          snippet: fullContent.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim()
        });
      }
      searchFrom = Math.max(end, start + 1);
    }
    const nextOffset = offset + matches.length;
    const hasMore = nextOffset < totalMatches;
    const content = totalMatches
      ? `已定位 ${totalMatches} 处匹配；本页从第 ${offset + 1} 处开始，可用 openCursor 读取上下文${hasMore ? "，或用 nextOffset 继续定位" : ""}。`
      : "未在正文中找到匹配文本。";
    return {
      title,
      ...(author ? { author } : {}),
      ...(publishedAt ? { publishedAt } : {}),
      content,
      truncated: totalMatches > matches.length,
      originalChars,
      contentChars: content.length,
      linkCount,
      results,
      find: {
        pattern: findPattern,
        offset,
        hasMore,
        sourceChars: fullContent.length,
        totalMatches,
        matches,
        ...(hasMore ? { nextOffset } : {})
      }
    };
  }

  // ------- 在段落边界内完成按需分块 -------
  const total = fullContent.length;
  const start = Math.min(total, Math.max(0, Math.floor(config.cursor || 0)));
  const remaining = fullContent.slice(start);
  let content = remaining;
  let end = total;
  if (remaining.length > config.maxChars) {
    const prefix = remaining.slice(0, config.maxChars);
    const paragraphBoundary = prefix.lastIndexOf("\n\n");
    const lineBoundary = prefix.lastIndexOf("\n");
    const sentenceBoundary = Math.max(
      prefix.lastIndexOf("。"),
      prefix.lastIndexOf("！"),
      prefix.lastIndexOf("？"),
      prefix.lastIndexOf(". ")
    );
    const preferredBoundary = Math.max(paragraphBoundary, lineBoundary, sentenceBoundary);
    const cutAt =
      preferredBoundary >= config.maxChars * 0.6 ? preferredBoundary + 1 : config.maxChars;
    content = prefix.slice(0, cutAt).trimEnd();
    end = start + cutAt;
    while (end < total && /\s/.test(fullContent[end] ?? "")) end += 1;
  }
  const hasMore = end < total;
  const contentRange = {
    start,
    end,
    total,
    hasMore,
    ...(hasMore ? { nextCursor: end } : {})
  };

  return {
    title,
    ...(author ? { author } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    content,
    truncated: hasMore,
    originalChars,
    contentChars: content.length,
    linkCount,
    results,
    ...(config.mode === "open" ? { contentRange } : {})
  };
}
