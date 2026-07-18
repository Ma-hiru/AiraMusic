import { normalizeWebHostname } from "./web-url-safety";

export const AgentWebSearchScopeValues = [
  "general",
  "moegirl",
  "baidu_baike",
  "zhihu",
  "news",
  "music_news",
  "acg_news",
  "official",
  "wikipedia"
] as const;

export type AgentWebSearchEngine = "bing" | "duckduckgo";
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

const AgentWebSearchScopeDefinitions: Record<AgentWebSearchScope, AgentWebSearchScopeDefinition> = {
  general: {
    label: "综合",
    domains: []
  },
  moegirl: {
    label: "萌娘百科",
    domains: ["zh.moegirl.org.cn"]
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
    queryExpression: "(官网 OR 官方网站 OR official)"
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
  const siteExpression = createSiteExpression(definition.domains);
  return {
    scope,
    label: definition.label,
    domains: [...definition.domains],
    queryExpression: [siteExpression, definition.queryExpression].filter(Boolean).join(" ")
  };
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

function createSiteExpression(domains: readonly string[]) {
  if (!domains.length) return "";
  if (domains.length === 1) return `site:${domains[0]}`;
  return `(${domains.map((domain) => `site:${domain}`).join(" OR ")})`;
}
