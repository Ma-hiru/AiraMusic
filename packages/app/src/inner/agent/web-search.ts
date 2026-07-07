export interface AgentWebSearchInput {
  query: string;
  site?: string;
  maxResults?: number;
}

export interface AgentWebSearchResult {
  url: string;
  title: string;
  snippet: string;
  publishedAt?: string;
}

export interface AgentWebSearchPayload {
  query: string;
  searchedAt: string;
  results: AgentWebSearchResult[];
  engine: AgentWebSearchProviderName;
}

type AgentWebSearchProviderName = "brave" | "serper" | "searxng" | "bing-rss";
type AgentWebSearchProviderOption = "auto" | AgentWebSearchProviderName;

interface AgentWebSearchEngine {
  available(): boolean;
  name: AgentWebSearchProviderName;
  search(query: string, maxResults: number, signal?: AbortSignal): Promise<AgentWebSearchResult[]>;
}

interface BraveSearchResponse {
  web?: {
    results?: {
      age?: string;
      url?: string;
      title?: string;
      page_age?: string;
      description?: string;
    }[];
  };
}

interface SerperSearchResponse {
  organic?: {
    date?: string;
    link?: string;
    title?: string;
    snippet?: string;
  }[];
}

interface SearXngSearchResponse {
  results?: {
    url?: string;
    title?: string;
    content?: string;
    publishedDate?: string;
  }[];
}

const AgentWebSearchTimeoutMs = 12_000;
const AgentWebSearchUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 AiraMusicAgent/1.0";

export async function searchWeb(
  input: AgentWebSearchInput,
  signal?: AbortSignal
): Promise<AgentWebSearchPayload> {
  const maxResults = clamp(input.maxResults ?? 5, 1, 8);
  const query = buildQuery(input.query, input.site);
  const errors: string[] = [];

  for (const engine of resolveSearchEngines()) {
    try {
      const results = uniqueByUrl(await engine.search(query, maxResults, signal)).slice(
        0,
        maxResults
      );
      if (!results.length) {
        errors.push(`${engine.name}: empty result`);
        continue;
      }

      return {
        query,
        engine: engine.name,
        searchedAt: new Date().toISOString(),
        results
      };
    } catch (error) {
      if (signal?.aborted || isAbortError(error)) throw error;
      errors.push(`${engine.name}: ${readErrorMessage(error)}`);
    }
  }

  throw new Error(`搜索服务不可用：${errors.join("；") || "没有可用 provider"}`);
}

const SearchEngines: AgentWebSearchEngine[] = [
  {
    name: "brave",
    available: () => Boolean(readEnv("AGENT_WEB_SEARCH_BRAVE_API_KEY")),
    search: searchBrave
  },
  {
    name: "serper",
    available: () => Boolean(readEnv("AGENT_WEB_SEARCH_SERPER_API_KEY")),
    search: searchSerper
  },
  {
    name: "searxng",
    available: () => Boolean(readEnv("AGENT_WEB_SEARCH_SEARXNG_URL")),
    search: searchSearXng
  },
  {
    name: "bing-rss",
    available: () => true,
    search: searchBingRss
  }
];

function resolveSearchEngines() {
  const provider = readProviderOption();
  if (provider === "auto") return SearchEngines.filter((engine) => engine.available());

  const engine = SearchEngines.find((item) => item.name === provider);
  if (!engine) {
    throw new Error(`未知网页搜索 provider：${provider}`);
  }
  if (!engine.available()) {
    throw new Error(`网页搜索 provider 缺少必要配置：${provider}`);
  }
  return [engine];
}

async function searchBrave(
  query: string,
  maxResults: number,
  signal?: AbortSignal
): Promise<AgentWebSearchResult[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("count", String(maxResults));
  url.searchParams.set("country", "us");
  url.searchParams.set("q", query);
  url.searchParams.set("search_lang", "en");

  const response = parseJson<BraveSearchResponse>(
    await fetchText(url, {
      signal,
      headers: {
        accept: "application/json",
        "x-subscription-token": readEnv("AGENT_WEB_SEARCH_BRAVE_API_KEY")!
      }
    })
  );

  return (response.web?.results ?? []).flatMap((item) => {
    const result = toSearchResult({
      url: item.url,
      title: item.title,
      snippet: item.description,
      publishedAt: item.page_age ?? item.age
    });
    return result ? [result] : [];
  });
}

async function searchSerper(
  query: string,
  maxResults: number,
  signal?: AbortSignal
): Promise<AgentWebSearchResult[]> {
  const url = new URL("https://google.serper.dev/search");
  const response = parseJson<SerperSearchResponse>(
    await fetchText(url, {
      signal,
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": readEnv("AGENT_WEB_SEARCH_SERPER_API_KEY")!
      },
      body: JSON.stringify({
        q: query,
        num: maxResults
      })
    })
  );

  return (response.organic ?? []).flatMap((item) => {
    const result = toSearchResult({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      publishedAt: item.date
    });
    return result ? [result] : [];
  });
}

async function searchSearXng(
  query: string,
  maxResults: number,
  signal?: AbortSignal
): Promise<AgentWebSearchResult[]> {
  const url = resolveSearXngSearchUrl(readEnv("AGENT_WEB_SEARCH_SEARXNG_URL")!);
  url.searchParams.set("categories", "general");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "auto");
  url.searchParams.set("q", query);
  url.searchParams.set("safesearch", "1");

  const response = parseJson<SearXngSearchResponse>(
    await fetchText(url, {
      signal,
      headers: {
        accept: "application/json"
      }
    })
  );

  return (response.results ?? []).flatMap((item) => {
    const result = toSearchResult({
      url: item.url,
      title: item.title,
      snippet: item.content,
      publishedAt: item.publishedDate
    });
    return result ? [result] : [];
  });
}

async function searchBingRss(
  query: string,
  maxResults: number,
  signal?: AbortSignal
): Promise<AgentWebSearchResult[]> {
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("cc", "US");
  url.searchParams.set("format", "rss");
  url.searchParams.set("mkt", "en-US");
  url.searchParams.set("q", query);
  url.searchParams.set("setlang", "en-US");

  const xml = await fetchText(url, { signal });
  const results = parseRssItems(xml);
  if (!results.length) {
    throw new Error("搜索服务没有返回可解析结果");
  }

  return uniqueByUrl(results).slice(0, maxResults);
}

async function fetchText(
  url: URL,
  options: {
    body?: string;
    method?: string;
    signal?: AbortSignal;
    headers?: Record<string, string>;
  } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AgentWebSearchTimeoutMs);
  const abort = () => controller.abort();

  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    const response = await fetch(url, {
      body: options.body,
      method: options.method,
      signal: controller.signal,
      headers: {
        accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.8",
        "user-agent": AgentWebSearchUserAgent,
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`搜索服务响应异常：${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

function parseRssItems(xml: string): AgentWebSearchResult[] {
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).flatMap((match) => {
    const item = match[1] ?? "";
    const title = cleanText(readTag(item, "title"));
    const url = cleanText(readTag(item, "link"));
    const snippet = cleanText(stripTags(readTag(item, "description")));
    const publishedAt = cleanText(readTag(item, "pubDate"));

    if (!title || !url) return [];

    return {
      url,
      title,
      snippet,
      ...(publishedAt ? { publishedAt } : {})
    };
  });
}

function parseJson<T>(text: string) {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new Error(`搜索服务返回了无效 JSON：${readErrorMessage(error)}`);
  }
}

function toSearchResult(input: {
  url?: string;
  title?: string;
  snippet?: string;
  publishedAt?: string;
}): undefined | AgentWebSearchResult {
  const title = cleanText(input.title ?? "");
  const url = cleanText(input.url ?? "");
  const snippet = cleanText(stripTags(input.snippet ?? ""));
  const publishedAt = cleanText(input.publishedAt ?? "");
  if (!title || !url) return;

  return {
    url,
    title,
    snippet,
    ...(publishedAt ? { publishedAt } : {})
  };
}

function readTag(xml: string, tag: string) {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  return xml.match(pattern)?.[1] ?? "";
}

function cleanText(value: string) {
  return decodeEntities(value.replace(/^<!\[CDATA\[/, "").replace(/]]>$/, ""))
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(value: string) {
  return value.replace(/<[^>]*>/g, " ");
}

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (raw, entity: string) => {
    if (entity.startsWith("#x")) {
      return safeFromCodePoint(Number.parseInt(entity.slice(2), 16), raw);
    }
    if (entity.startsWith("#")) {
      return safeFromCodePoint(Number.parseInt(entity.slice(1), 10), raw);
    }
    switch (entity) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return raw;
    }
  });
}

function safeFromCodePoint(codePoint: number, fallback: string) {
  if (!Number.isFinite(codePoint)) return fallback;
  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return fallback;
  }
}

function uniqueByUrl(results: AgentWebSearchResult[]) {
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.url)) return false;
    seen.add(result.url);
    return true;
  });
}

function resolveSearXngSearchUrl(value: string) {
  const url = new URL(value);
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname.endsWith("/search")) {
    url.pathname = `${pathname}/search`;
  }
  return url;
}

function buildQuery(query: string, site?: string) {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const normalizedSite = normalizeSite(site);
  if (!normalizedSite) return normalizedQuery;
  return `${normalizedQuery} site:${normalizedSite}`;
}

function normalizeSite(site?: string) {
  return site
    ?.trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    ?.trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function readProviderOption(): AgentWebSearchProviderOption {
  const value = readEnv("AGENT_WEB_SEARCH_PROVIDER")?.toLowerCase();
  switch (value) {
    case undefined:
    case "auto":
      return "auto";
    case "bing":
    case "bing-rss":
      return "bing-rss";
    case "brave":
      return "brave";
    case "searx":
    case "searxng":
      return "searxng";
    case "serper":
      return "serper";
    default:
      throw new Error(`未知网页搜索 provider：${value}`);
  }
}

function readEnv(key: string) {
  const value = process.env[key]?.trim();
  return value || undefined;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
