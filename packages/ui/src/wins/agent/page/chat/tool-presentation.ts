import {
  Bot,
  Disc3,
  Radio,
  Globe2,
  Music2,
  Search,
  Sparkles,
  ListMusic,
  Settings2,
  UserRound,
  MessageCircle,
  type LucideIcon,
  SlidersHorizontal
} from "lucide-react";

export type AgentToolPresentation = {
  label: string;
  category: string;
  icon: LucideIcon;
};

const exactLabels: Record<string, string> = {
  "agent-search": "搜索音乐资源",
  "agent-lyric-schema": "读取歌词结构",
  "agent-tool-web-browser": "浏览网页",
  "agent-tool-track-detail": "读取歌曲详情",
  "agent-tool-track-playable": "检查播放权限",
  "agent-tool-track-lyrics": "读取歌曲歌词",
  "agent-tool-track-similar": "查找相似歌曲",
  "agent-tool-track-play": "播放歌曲",
  "agent-tool-replace-lyrics": "更新歌词",
  "agent-tool-player-action": "控制播放器",
  "agent-tool-player-current": "读取播放状态",
  "agent-tool-player-volume": "调整音量",
  "agent-tool-player-seek": "跳转播放进度",
  "agent-tool-player-queue": "读取播放队列",
  "agent-tool-player-queue-add": "加入播放队列",
  "agent-tool-player-queue-remove": "整理播放队列",
  "agent-tool-player-mode": "设置播放模式",
  "agent-tool-album-detail": "读取专辑详情",
  "agent-tool-album-new": "查找新专辑",
  "agent-tool-album-star": "更新专辑收藏",
  "agent-tool-artist-detail": "读取艺人详情",
  "agent-tool-artist-hot-tracks": "读取艺人热歌",
  "agent-tool-artist-albums": "读取艺人专辑",
  "agent-tool-artist-similar": "查找相似艺人",
  "agent-tool-artist-toplist": "读取歌手榜单",
  "agent-tool-artist-desc": "读取艺人介绍",
  "agent-tool-playlist-detail": "读取歌单详情",
  "agent-tool-playlist-recommend": "查找推荐歌单",
  "agent-tool-playlist-create": "创建歌单",
  "agent-tool-playlist-delete": "删除歌单",
  "agent-tool-playlist-modify": "更新歌单内容",
  "agent-tool-playlist-star": "更新歌单收藏",
  "agent-tool-playlist-similar": "查找相似歌单",
  "agent-tool-playlist-top": "读取精选歌单",
  "agent-tool-track-comment": "读取评论",
  "agent-tool-comment-send": "发送评论",
  "agent-tool-comment-like": "更新评论点赞",
  "agent-tool-user-info": "读取用户信息",
  "agent-tool-user-playlists": "读取用户歌单",
  "agent-tool-user-play-history": "读取播放历史",
  "agent-tool-track-like": "更新喜欢状态",
  "agent-tool-track-recommend-daily": "读取每日推荐",
  "agent-tool-track-recommend-new": "查找新歌",
  "agent-tool-track-fm": "读取私人 FM",
  "agent-tool-fm-trash": "移出私人 FM",
  "agent-tool-search-hot": "读取热搜",
  "agent-tool-search-suggest": "读取搜索建议",
  "agent-tool-search-open": "打开搜索页面",
  "agent-tool-source-open": "打开音乐页面",
  "agent-tool-comment-open": "打开评论页面",
  "agent-tool-home-toplists": "读取音乐榜单",
  "agent-tool-settings-get": "读取应用设置",
  "agent-tool-change-settings": "更新应用设置",
  "agent-tool-record": "读取听歌统计"
};

export function getAgentToolPresentation(name: string): AgentToolPresentation {
  const label = exactLabels[name] ?? humanizeToolName(name);

  if (name === "agent-tool-web-browser") {
    return { label, icon: Globe2, category: "WEB" };
  }
  if (name.includes("search")) {
    return { label, icon: Search, category: "SEARCH" };
  }
  if (name.includes("playlist") || name.includes("queue")) {
    return { label, icon: ListMusic, category: "COLLECTION" };
  }
  if (name.includes("artist")) {
    return { label, icon: UserRound, category: "ARTIST" };
  }
  if (name.includes("album")) {
    return { label, icon: Disc3, category: "ALBUM" };
  }
  if (name.includes("comment")) {
    return { label, icon: MessageCircle, category: "SOCIAL" };
  }
  if (name.includes("player") || name.includes("track-play")) {
    return { label, icon: SlidersHorizontal, category: "PLAYER" };
  }
  if (name.includes("settings")) {
    return { label, icon: Settings2, category: "SYSTEM" };
  }
  if (name.includes("user")) {
    return { label, icon: UserRound, category: "PROFILE" };
  }
  if (name.includes("fm") || name.includes("recommend")) {
    return { label, icon: Radio, category: "DISCOVERY" };
  }
  if (name.includes("lyric") || name.includes("track")) {
    return { label, icon: Music2, category: "MUSIC" };
  }
  if (name.includes("record") || name.includes("toplist")) {
    return { label, icon: Sparkles, category: "INSIGHT" };
  }
  return { label, icon: Bot, category: "TOOL" };
}

export function parseAgentToolValue(value?: string): unknown {
  if (!value?.trim()) return undefined;

  let parsed: unknown = value;
  for (let depth = 0; depth < 2 && typeof parsed === "string"; depth++) {
    const text = parsed.trim();
    if (!looksLikeJSON(text)) break;
    try {
      parsed = JSON.parse(text);
    } catch {
      break;
    }
  }
  return parsed;
}

export function isAgentToolError(output?: string) {
  const value = parseAgentToolValue(output);
  return isRecord(value) && isRecord(value["error"]);
}

export function getAgentToolSummary(props: {
  name: string;
  input?: string;
  output?: string;
  running?: boolean;
}) {
  const input = parseAgentToolValue(props.input);
  const output = parseAgentToolValue(props.output);

  const errorMessage = getNestedString(output, "error", "message");
  if (errorMessage) return errorMessage;

  if (props.name === "agent-tool-web-browser") {
    const action = getString(input, "action");
    const query = getString(input, "query");
    const url = getString(input, "url");
    const title = getString(output, "title");
    const resultURL = getString(output, "url") || url;
    const scopeLabel = readWebSearchScopeLabel(input, output);

    if (action === "search") {
      if (props.running) {
        return query
          ? `正在从${scopeLabel || "网页"}搜索「${query}」`
          : `正在搜索${scopeLabel || "网页"}`;
      }
      const result = title || (query ? `已搜索「${query}」` : "网页搜索完成");
      return scopeLabel ? `${scopeLabel} · ${result}` : result;
    }
    if (props.running) return resultURL ? `正在读取 ${getDomain(resultURL)}` : "正在读取网页";
    return title || (resultURL ? `已读取 ${getDomain(resultURL)}` : "网页读取完成");
  }

  const keyword = getString(input, "keyword");
  if (keyword) return props.running ? `正在处理「${keyword}」` : `已处理「${keyword}」`;

  const name = getString(output, "name") || getString(input, "name");
  if (name) return name;

  const message = getString(output, "message");
  if (message) return message;

  const title = getString(output, "title");
  if (title) return title;

  const resultCount = getFirstArray(output, ["items", "results", "tracks", "comments"])?.length;
  if (resultCount) return `已返回 ${resultCount} 项结果`;

  return props.running ? "正在等待工具返回" : "工具已返回结果";
}

export type AgentToolSemanticResult = {
  title: string;
  truncated?: boolean;
  description?: string;
  facts: Array<{ label: string; value: string }>;
  items: Array<{ title: string; subtitle?: string }>;
};

/**
 * 将工具 JSON 投影为适合人阅读的短结果。这里只做保守提取，原始值仍会在
 * “技术详情”中完整保留。
 */
export function getAgentToolSemanticResult(
  name: string,
  output?: string
): null | AgentToolSemanticResult {
  const value = parseAgentToolValue(output);
  if (value === undefined) return null;

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return { title: clipText(String(value), 160), facts: [], items: [] };
  }
  if (!isRecord(value)) {
    return Array.isArray(value)
      ? {
          title: `已返回 ${value.length} 项结果`,
          facts: [],
          items: value.slice(0, 3).flatMap(readSemanticItem)
        }
      : null;
  }

  const errorMessage = getNestedString(value, "error", "message");
  if (errorMessage) {
    return {
      title: errorMessage,
      description: getNestedString(value, "error", "type") || undefined,
      facts: [],
      items: []
    };
  }

  const unwrapped = unwrapSemanticValue(value);
  const title =
    getString(unwrapped, "message") ||
    getString(unwrapped, "reason") ||
    getString(unwrapped, "name") ||
    getString(unwrapped, "title") ||
    getString(unwrapped, "text");
  const description = readDescription(unwrapped);
  const list = getFirstArray(unwrapped, [
    "items",
    "results",
    "tracks",
    "hotTracks",
    "comments",
    "hotComments",
    "playlists",
    "albums",
    "artists"
  ]);
  const items = list?.slice(0, 3).flatMap(readSemanticItem) ?? [];
  const facts = readSemanticFacts(unwrapped);
  const meta = isRecord(value["_meta"]) ? value["_meta"] : undefined;

  return {
    title:
      clipText(title, 160) ||
      (items.length ? `已返回 ${list?.length ?? items.length} 项结果` : getResultFallback(name)),
    ...(description ? { description: clipText(description, 240) } : {}),
    ...(meta?.["truncated"] === true ? { truncated: true } : {}),
    facts,
    items
  };
}

export type AgentWebToolDetails = {
  url?: string;
  site?: string;
  query?: string;
  scope?: string;
  title?: string;
  domain?: string;
  engine?: string;
  linkCount?: number;
  scopeLabel?: string;
  truncated?: boolean;
  contentChars?: number;
  originalChars?: number;
  scopeDomains: string[];
  results: Array<{
    url: string;
    title: string;
    domain: string;
    snippet: string;
  }>;
};

export function getAgentWebToolDetails(input?: string, output?: string): AgentWebToolDetails {
  const inputValue = parseAgentToolValue(input);
  const outputValue = parseAgentToolValue(output);
  const url = getString(outputValue, "url") || getString(inputValue, "url") || undefined;
  const search =
    isRecord(outputValue) && isRecord(outputValue["search"]) ? outputValue["search"] : undefined;
  const site = getString(search, "customSite") || getString(inputValue, "site") || undefined;
  const scope = getString(search, "scope") || getString(inputValue, "scope") || undefined;
  const scopeDomains = getStringArray(search, "domains");

  return {
    url,
    site,
    scope,
    domain: url ? getDomain(url) : undefined,
    query: getString(inputValue, "query") || undefined,
    engine: getString(inputValue, "engine") || undefined,
    scopeLabel:
      getString(search, "label") ||
      (site ? "指定站点" : scope ? WebSearchScopeLabels[scope] : "综合"),
    scopeDomains: scopeDomains.length ? scopeDomains : site ? [site] : [],
    title: getString(outputValue, "title") || undefined,
    linkCount: getNumber(outputValue, "linkCount"),
    truncated: getBoolean(outputValue, "truncated"),
    contentChars: getNumber(outputValue, "contentChars"),
    originalChars: getNumber(outputValue, "originalChars"),
    results: getSearchResults(outputValue)
  };
}

const WebSearchScopeLabels: Record<string, string> = {
  general: "综合",
  moegirl: "萌娘百科",
  baidu_baike: "百度百科",
  zhihu: "知乎",
  news: "新闻",
  music_news: "音乐新闻",
  acg_news: "ACG 新闻",
  official: "官方资料",
  wikipedia: "维基百科"
};

function readWebSearchScopeLabel(input: unknown, output: unknown) {
  const search = isRecord(output) && isRecord(output["search"]) ? output["search"] : undefined;
  const customSite = getString(search, "customSite") || getString(input, "site");
  if (customSite) return customSite;
  const label = getString(search, "label");
  if (label) return label;
  const scope = getString(input, "scope");
  return scope ? WebSearchScopeLabels[scope] || scope : "";
}

function getSearchResults(value: unknown): AgentWebToolDetails["results"] {
  if (!isRecord(value) || !Array.isArray(value["results"])) return [];
  return value["results"].flatMap((item) => {
    if (!isRecord(item)) return [];
    const url = getString(item, "url");
    const title = getString(item, "title");
    if (!url || !title) return [];
    return {
      url,
      title,
      domain: getString(item, "domain") || getDomain(url),
      snippet: getString(item, "snippet")
    };
  });
}

const SemanticFactLabels: Record<string, string> = {
  trackCount: "歌曲",
  albumCount: "专辑",
  commentCount: "评论",
  shareCount: "分享",
  subscribedCount: "收藏",
  playCount: "播放",
  mvCount: "MV",
  linkCount: "链接"
};

function unwrapSemanticValue(value: Record<string, unknown>) {
  const data = value["data"];
  if (isRecord(data) && Object.keys(value).every((key) => key === "data" || key === "_meta")) {
    return data;
  }
  return value;
}

function readDescription(value: Record<string, unknown>) {
  const direct =
    getString(value, "description") ||
    getString(value, "briefDescription") ||
    getString(value, "snippet");
  if (direct) return direct;

  const artists = readNames(value["artists"]);
  const album = isRecord(value["album"]) ? getString(value["album"], "name") : "";
  return [artists, album].filter(Boolean).join(" · ");
}

function readSemanticFacts(value: Record<string, unknown>) {
  return Object.entries(SemanticFactLabels).flatMap(([key, label]) => {
    const candidate = value[key];
    if (typeof candidate !== "number" || !Number.isFinite(candidate)) return [];
    return [{ label, value: formatCompactNumber(candidate) }];
  });
}

function readSemanticItem(value: unknown): AgentToolSemanticResult["items"] {
  if (typeof value === "string") return [{ title: clipText(value, 120) }];
  if (!isRecord(value)) return [];

  const item = isRecord(value["track"]) ? value["track"] : value;
  const title =
    getString(item, "name") ||
    getString(item, "title") ||
    getString(item, "content") ||
    getString(item, "message");
  if (!title) return [];

  const artists = readNames(item["artists"]);
  const album = isRecord(item["album"]) ? getString(item["album"], "name") : "";
  const creator = isRecord(item["creator"]) ? getString(item["creator"], "nickname") : "";
  const user = isRecord(item["user"]) ? getString(item["user"], "nickname") : "";
  const subtitle = [artists, album, creator || user].filter(Boolean).join(" · ");

  return [
    {
      title: clipText(title, 120),
      ...(subtitle ? { subtitle: clipText(subtitle, 120) } : {})
    }
  ];
}

function readNames(value: unknown) {
  if (!Array.isArray(value)) return "";
  return value
    .flatMap((item) =>
      isRecord(item) ? getString(item, "name") : typeof item === "string" ? item : ""
    )
    .filter(Boolean)
    .slice(0, 3)
    .join(" / ");
}

function getFirstArray(value: unknown, keys: string[]) {
  if (!isRecord(value)) return undefined;
  for (const key of keys) {
    if (Array.isArray(value[key])) return value[key];
  }
  return undefined;
}

function getNestedString(value: unknown, parent: string, key: string) {
  if (!isRecord(value) || !isRecord(value[parent])) return "";
  return getString(value[parent], key);
}

function getResultFallback(name: string) {
  if (name.includes("play") || name.includes("open") || name.includes("modify"))
    return "操作已完成";
  if (name.includes("search") || name.includes("recommend")) return "已返回匹配结果";
  return "已读取结构化结果";
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);
}

function clipText(value: string, maxChars: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? `${normalized.slice(0, maxChars - 1)}…` : normalized;
}

function humanizeToolName(name: string) {
  const value = name
    .replace(/^agent(?:-tool)?-/, "")
    .replaceAll("-", " ")
    .trim();
  return value ? value.replace(/\b\w/g, (character) => character.toUpperCase()) : "工具调用";
}

function looksLikeJSON(value: string) {
  return (
    (value.startsWith("{") && value.endsWith("}")) ||
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith('"') && value.endsWith('"'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown, key: string) {
  if (!isRecord(value)) return "";
  const candidate = value[key];
  return typeof candidate === "string" ? candidate : "";
}

function getNumber(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "number" ? candidate : undefined;
}

function getBoolean(value: unknown, key: string) {
  if (!isRecord(value)) return undefined;
  const candidate = value[key];
  return typeof candidate === "boolean" ? candidate : undefined;
}

function getStringArray(value: unknown, key: string) {
  if (!isRecord(value) || !Array.isArray(value[key])) return [];
  return value[key].filter((item): item is string => typeof item === "string");
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
