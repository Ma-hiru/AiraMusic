import { randomBytes } from "node:crypto";

import { normalizeWebHostname } from "./web-url-safety";

export const AgentWebSearchScopeValues = [
  "general",
  "encyclopedia",
  "moegirl",
  "baidu_baike",
  "zhihu",
  "news",
  "music_news",
  "acg_news",
  "official",
  "wikipedia"
] as const;

export type AgentWebSearchEngine = "bing" | "baidu" | "duckduckgo";
export type AgentWebSearchScope = (typeof AgentWebSearchScopeValues)[number];

type AgentWebSearchScopeDefinition = {
  label: string;
  queryExpression?: string;
  domains: readonly string[];
};

export type ResolvedAgentWebSearchScope = {
  label: string;
  domains: string[];
  customSite?: string;
  queryExpression: string;
  scope: AgentWebSearchScope;
};

/** 国内网络下 DDG 常不可达；Bing 偶发反爬。按可用性排序。 */
export const AgentWebSearchEngineOrder: readonly AgentWebSearchEngine[] = [
  "bing",
  "baidu",
  "duckduckgo"
];

/**
 * 普通日文/中文查询被 Bing 反爬时，用优质 ACG/百科站点偏置再搜一轮。
 * 萌娘百科正式站：https://zh.moegirl.org.cn/
 */
export const AgentWebSearchAcgRecoverySites = [
  "zh.moegirl.org.cn",
  "w.atwiki.jp",
  "bilibili.com"
] as const;

const AgentWebSearchScopeDefinitions: Record<AgentWebSearchScope, AgentWebSearchScopeDefinition> = {
  general: {
    label: "综合",
    domains: []
  },
  encyclopedia: {
    label: "百科资料",
    // 过滤用父域覆盖镜像；site: 用正式站 zh.moegirl.org.cn。
    domains: ["moegirl.org.cn", "baike.baidu.com", "wikipedia.org"],
    queryExpression: "(site:zh.moegirl.org.cn OR site:baike.baidu.com OR site:wikipedia.org)"
  },
  moegirl: {
    label: "萌娘百科",
    domains: ["zh.moegirl.org.cn", "moegirl.org.cn"],
    queryExpression: "site:zh.moegirl.org.cn"
  },
  baidu_baike: {
    label: "百度百科",
    domains: ["baike.baidu.com"]
  },
  zhihu: {
    label: "知乎",
    domains: ["zhihu.com"]
  },
  news: {
    label: "新闻",
    domains: ["news.cn", "chinanews.com.cn"]
  },
  music_news: {
    label: "音乐新闻",
    domains: ["natalie.mu", "oricon.co.jp", "billboard-japan.com"]
  },
  acg_news: {
    label: "ACG 新闻",
    domains: ["lisani.jp", "animeanime.jp", "animenewsnetwork.com", "natalie.mu"]
  },
  official: {
    label: "官方资料",
    domains: [],
    queryExpression: "(官网 OR 官方网站 OR 公式 OR official)"
  },
  wikipedia: {
    label: "维基百科",
    domains: ["wikipedia.org"]
  }
};

export function resolveAgentWebSearchScope(
  scope: AgentWebSearchScope = "general",
  site?: string
): ResolvedAgentWebSearchScope {
  if (site) {
    const customSite = normalizeAgentWebSearchSite(site);
    return {
      scope,
      customSite,
      label: "指定站点",
      domains: [customSite],
      queryExpression: `site:${customSite}`
    };
  }

  const definition = AgentWebSearchScopeDefinitions[scope];
  // 若预设自带完整 site 表达式（如萌娘正式站），不再用 domains 拼第二份。
  const siteExpression = definition.queryExpression?.includes("site:")
    ? ""
    : createSiteExpression(definition.domains);
  return {
    scope,
    label: definition.label,
    domains: [...definition.domains],
    queryExpression: [siteExpression, definition.queryExpression].filter(Boolean).join(" ")
  };
}

export function resolveSearchEngineOrder(
  preferred: AgentWebSearchEngine = "bing"
): AgentWebSearchEngine[] {
  return [preferred, ...AgentWebSearchEngineOrder.filter((engine) => engine !== preferred)];
}

export function queryHasCjkScript(query: string): boolean {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(query);
}

export function createWebSearchURL(
  query: string,
  site?: string,
  engine: AgentWebSearchEngine = "bing",
  scope: AgentWebSearchScope = "general"
): URL {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) throw new Error("搜索关键字不能为空");

  const resolvedScope = resolveAgentWebSearchScope(scope, site);
  const fullQuery = [normalizedQuery, resolvedScope.queryExpression].filter(Boolean).join(" ");
  return buildEngineSearchURL(engine, fullQuery);
}

/** Bing 综合搜索空结果时的单站偏置查询。多站 OR 易触发 cn.bing 反爬，故按站逐个试。 */
export function createAcgRecoverySearchURL(
  query: string,
  site: string = AgentWebSearchAcgRecoverySites[0]
): URL {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) throw new Error("搜索关键字不能为空");
  const normalizedSite = normalizeAgentWebSearchSite(site);
  return buildEngineSearchURL("bing", `${normalizedQuery} site:${normalizedSite}`);
}

export function listAcgRecoverySearchURLs(query: string): URL[] {
  return AgentWebSearchAcgRecoverySites.map((site) => createAcgRecoverySearchURL(query, site));
}

export function normalizeAgentWebSearchSite(site: string): string {
  const value = site.trim();
  if (!value) throw new Error("搜索站点不能为空");
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return normalizeWebHostname(url.hostname)
      .replace(/^www\./i, "")
      .toLowerCase();
  } catch {
    throw new Error("搜索站点格式无效");
  }
}

export function isBingSearchURL(url: URL): boolean {
  return /(?:^|\.)bing\.com$/i.test(url.hostname) && url.pathname.startsWith("/search");
}

/** 与 web-search-mcp 一致的 32 位 hex cvid，降低直接打开 SERP 被当成机器人的概率。 */
export function createBingConversationId(): string {
  return randomBytes(16).toString("hex");
}

function buildEngineSearchURL(engine: AgentWebSearchEngine, fullQuery: string): URL {
  if (engine === "duckduckgo") {
    // lite 版对无头浏览器更稳；但国内网络常整页超时，仅作末位备用。
    const url = new URL("https://lite.duckduckgo.com/lite/");
    url.searchParams.set("q", fullQuery);
    return url;
  }
  if (engine === "baidu") {
    const url = new URL("https://www.baidu.com/s");
    url.searchParams.set("wd", fullQuery);
    url.searchParams.set("ie", "utf-8");
    return url;
  }
  // Bing 参数对齐 web-search-mcp direct search：form/cvid，不用 setlang=zh-Hans（易被打到 cn.bing 反爬页）。
  const url = new URL("https://www.bing.com/search");
  url.searchParams.set("q", fullQuery);
  url.searchParams.set("count", "10");
  url.searchParams.set("form", "QBLH");
  url.searchParams.set("sp", "-1");
  url.searchParams.set("qs", "n");
  url.searchParams.set("cvid", createBingConversationId());
  return url;
}

function createSiteExpression(domains: readonly string[]) {
  if (!domains.length) return "";
  if (domains.length === 1) return `site:${domains[0]}`;
  return `(${domains.map((domain) => `site:${domain}`).join(" OR ")})`;
}
