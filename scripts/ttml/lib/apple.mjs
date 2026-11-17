/**
 * Apple Music 歌词（TTML）抓取核心库。
 *
 * 依赖的能力：
 * 1. Developer Token —— 内嵌在 music.apple.com 的 JS bundle 里，有效期约一年，可自动抓取。
 * 2. Media User Token（MUT）—— 登录后写入 music.apple.com 的 `media-user-token` Cookie，
 *    歌词接口必须携带，由用户在本地授权页提供。
 *
 * 歌词接口：
 *   GET /v1/catalog/{storefront}/songs/{id}/syllable-lyrics?extend=ttml&format=ttml  逐字（优先）
 *   GET /v1/catalog/{storefront}/songs/{id}/lyrics?extend=ttml&format=ttml           逐行（兜底）
 */
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MUSIC_ORIGIN = "https://music.apple.com";
const API_ORIGIN = "https://amp-api.music.apple.com";

/** Web Play 的 developer token，payload 中带 exp，可复用。 */
const DEV_TOKEN_RE =
  /eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NiIsImtpZCI6IldlYlBsYXlLaWQifQ\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/;

const BASE_HEADERS = {
  "User-Agent": USER_AGENT,
  Origin: MUSIC_ORIGIN,
  Referer: MUSIC_ORIGIN + "/"
};

export class AppleApiError extends Error {
  constructor(message, { status, code, path } = {}) {
    super(message);
    this.name = "AppleApiError";
    this.status = status;
    this.code = code;
    this.path = path;
  }

  /** 该曲目在 Apple 侧没有可用歌词 */
  get isMissing() {
    return this.status === 404;
  }

  /** 鉴权失效：MUT 过期或被吊销 */
  get isUnauthorized() {
    return this.status === 401 || this.status === 403;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Apple 对匿名调用限流很严（实测并发 3 无间隔时大量 429），
 * 所有请求串行化并保底 350ms 间隔；遇到 429 再额外冷却。
 */
const MIN_GAP = 350;
let queue = Promise.resolve();
let lastCallAt = 0;
let cooldownUntil = 0;

function scheduled(task) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_GAP - Date.now(), cooldownUntil - Date.now());
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return task();
  });
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * 带超时与重试的请求。429/5xx 退避重试，其余错误直接抛出。
 */
async function request(url, { headers = {}, retry = 5, timeout = 15000 } = {}) {
  return scheduled(() => requestUnsafe(url, { headers, retry, timeout }));
}

async function requestUnsafe(url, { headers = {}, retry = 5, timeout = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < retry; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { ...BASE_HEADERS, ...headers },
        signal: controller.signal
      });
      // 429 说明被限流：先全局冷却，所有排队请求一起等
      if (response.status === 429) {
        lastError = new AppleApiError("被 Apple 限流（429）", { status: 429, path: url });
        cooldownUntil = Date.now() + 4000 * (attempt + 1);
        continue;
      }
      if (response.status >= 500) {
        lastError = new AppleApiError(`HTTP ${response.status}`, {
          status: response.status,
          path: url
        });
        await sleep(800 * (attempt + 1));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (error?.name === "AbortError") {
        lastError = new AppleApiError("请求超时", { path: url });
      }
      await sleep(400 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new AppleApiError("请求失败", { path: url });
}

async function requestJSON(url, options) {
  const response = await request(url, options);
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppleApiError(`响应不是合法 JSON（HTTP ${response.status}）`, {
      status: response.status,
      path: url
    });
  }
  if (!response.ok) {
    const detail = body?.errors?.[0];
    throw new AppleApiError(detail?.detail || detail?.title || `HTTP ${response.status}`, {
      status: response.status,
      code: detail?.code,
      path: url
    });
  }
  return body;
}

/** 从 music.apple.com 的前端 bundle 中提取 developer token */
export async function fetchDeveloperToken() {
  const page = await request(`${MUSIC_ORIGIN}/cn/browse`, { timeout: 20000 });
  if (!page.ok) {
    throw new AppleApiError(`无法访问 music.apple.com（HTTP ${page.status}）`, {
      status: page.status
    });
  }
  const html = await page.text();

  const inline = html.match(DEV_TOKEN_RE);
  if (inline) return inline[0];

  const assets = [...html.matchAll(/\/assets\/[A-Za-z0-9._~-]+\.js/g)]
    .map((match) => match[0])
    .filter((asset, index, all) => all.indexOf(asset) === index)
    .slice(0, 4);

  for (const asset of assets) {
    const script = await request(`${MUSIC_ORIGIN}${asset}`, { timeout: 25000, retry: 2 });
    if (!script.ok) continue;
    const found = (await script.text()).match(DEV_TOKEN_RE);
    if (found) return found[0];
  }

  throw new AppleApiError("未能从 music.apple.com 提取 developer token，页面结构可能已变更");
}

export function decodeTokenExpiry(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * 本地凭据存储。文件权限 600，默认位于 scripts/ttml/.auth.json（已在 .gitignore 中）。
 */
export class AuthStore {
  constructor(file) {
    this.file = file;
    this.data = null;
  }

  async load() {
    if (this.data) return this.data;
    try {
      this.data = JSON.parse(await readFile(this.file, "utf8"));
    } catch {
      this.data = null;
    }
    return this.data;
  }

  async save(patch) {
    const next = { ...(await this.load()), ...patch, savedAt: new Date().toISOString() };
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify(next, null, 2), "utf8");
    await chmod(this.file, 0o600).catch(() => {});
    this.data = next;
    return next;
  }

  async clear() {
    this.data = null;
    await writeFile(this.file, "{}", "utf8").catch(() => {});
  }
}

/** 读取 `media-user-token` 形式的 MUT，兼容直接粘贴整段 Cookie 的情况 */
export function normalizeMediaUserToken(raw) {
  if (!raw) return "";
  const value = String(raw).trim();
  const matched = value.match(/media-user-token=([^;]+)/);
  return (matched ? matched[1] : value).replace(/^["']|["']$/g, "").trim();
}

export class AppleMusicClient {
  /**
   * @param {{ mediaUserToken?: string, developerToken?: string, storefront?: string }} options
   */
  constructor({ mediaUserToken, developerToken, storefront = "cn" } = {}) {
    this.mediaUserToken = normalizeMediaUserToken(mediaUserToken);
    this.developerToken = developerToken;
    this.storefront = storefront;
    this._storefrontVerified = false;
  }

  async ensureDeveloperToken() {
    if (!this.developerToken) this.developerToken = await fetchDeveloperToken();
    return this.developerToken;
  }

  /**
   * @param {object} [options]
   * @param {boolean} [options.mediaUser] 是否附带 Media-User-Token。
   *   实测 catalog 搜索带上 MUT 会被 Apple 单独限流（429），且搜索本身不需要它。
   */
  async api(path, { query, auth = true, mediaUser = true, ...rest } = {}) {
    const url = new URL(path.startsWith("http") ? path : API_ORIGIN + path);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
    const headers = {};
    if (auth) {
      headers.Authorization = `Bearer ${await this.ensureDeveloperToken()}`;
      if (this.mediaUserToken && mediaUser) headers["Media-User-Token"] = this.mediaUserToken;
    }
    return requestJSON(url.toString(), { ...rest, headers: { ...headers, ...rest.headers } });
  }

  /** 用 /v1/me/storefront 校验 MUT 是否有效，同时拿到店铺区域 */
  async verifyAuth() {
    const body = await this.api("/v1/me/storefront", { query: { limit: 1 } });
    const storefront = body?.data?.[0]?.id;
    if (!storefront) throw new AppleApiError("商店区域解析失败，MUT 可能无效");
    this.storefront = storefront;
    this._storefrontVerified = true;
    return {
      storefront,
      language: body?.data?.[0]?.attributes?.defaultLanguageTag ?? null
    };
  }

  async paginate(path, { query = {}, limit = 100, maxItems = 500, signal } = {}) {
    const items = [];
    let offset = 0;
    while (items.length < maxItems) {
      if (signal?.aborted) break;
      const pageSize = Math.min(100, limit - items.length, maxItems - items.length);
      if (pageSize <= 0) break;
      const body = await this.api(path, { query: { ...query, limit: pageSize, offset } });
      const data = body?.data ?? [];
      items.push(...data);
      const next = body?.next;
      if (!next || data.length === 0) break;
      offset += data.length;
    }
    return items;
  }

  /** 用户资料库中已添加的歌曲 */
  async listLibrarySongs({ limit = 100, maxItems = 500 } = {}) {
    const items = await this.paginate("/v1/me/library/songs", {
      query: { include: "catalog" },
      limit,
      maxItems
    });
    return items.map((item) => normalizeSong(item, "library"));
  }

  /** 最近播放的曲目。Apple 对该接口单页上限为 30 首 */
  async listRecentPlayed({ limit = 100 } = {}) {
    const songs = [];
    let offset = 0;
    while (songs.length < limit) {
      const pageSize = Math.min(30, limit - songs.length);
      const body = await this.api("/v1/me/recent/played/tracks", {
        query: { limit: pageSize, offset, types: "songs" }
      });
      const data = body?.data ?? [];
      songs.push(...data.map((item) => normalizeSong(item, "recent")));
      if (!body?.next || data.length === 0) break;
      offset += data.length;
    }
    return songs;
  }

  /**
   * 重度聆听（常听）。Apple 以专辑维度返回，这里展开成曲目。
   * 注意真实路径是 /v1/me/history/heavy-rotation，账号无数据时返回空数组。
   */
  async listHeavyRotation({ limit = 100, signal } = {}) {
    const body = await this.api("/v1/me/history/heavy-rotation", {
      query: { limit: 10 }
    });
    const albums = (body?.data ?? []).filter((item) => item.type === "albums");
    const songs = [];
    for (const album of albums) {
      if (signal?.aborted || songs.length >= limit) break;
      const tracks = await this.api(`/v1/catalog/${this.storefront}/albums/${album.id}/tracks`, {
        query: { limit: 50 }
      }).catch(() => null);
      for (const track of tracks?.data ?? []) songs.push(normalizeSong(track, "heavy-rotation"));
    }
    return songs.slice(0, limit);
  }

  /** 检索并返回候选列表（含时长，供上层做打分匹配） */
  async searchCandidates(term, { limit = 20 } = {}) {
    const body = await this.api(`/v1/catalog/${this.storefront}/search`, {
      query: { term, types: "songs", limit },
      mediaUser: false
    });
    return (body?.results?.songs?.data ?? []).map((item) => normalizeSong(item, "search"));
  }

  /** 按歌名 + 歌手在 Apple 曲库中检索，用于把外部歌单（如网易云红心）映射到 Apple 曲目 */
  async searchSong(name, artist) {
    const term = [name, artist].filter(Boolean).join(" ");
    if (!term) return null;
    const body = await this.api(`/v1/catalog/${this.storefront}/search`, {
      query: { term, types: "songs", limit: 5 },
      mediaUser: false
    });
    const candidates = body?.results?.songs?.data ?? [];
    if (candidates.length === 0) return null;
    const loweredArtist = (artist ?? "").toLowerCase();
    const exact =
      candidates.find(
        (item) =>
          item.attributes.name === name &&
          item.attributes.artistName?.toLowerCase().includes(loweredArtist)
      ) ?? candidates[0];
    return normalizeSong(exact, "search");
  }

  /**
   * 抓取单曲歌词。优先逐字 syllable-lyrics，其次逐行 lyrics。
   * @returns {Promise<{ ttml: string, kind: "syllable" | "line" }>}
   */
  async getLyrics(songId) {
    const attempts = [
      { kind: "syllable", path: `/v1/catalog/${this.storefront}/songs/${songId}/syllable-lyrics` },
      { kind: "line", path: `/v1/catalog/${this.storefront}/songs/${songId}/lyrics` }
    ];
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const ttml = await this.requestTTML(attempt.path);
        if (ttml) return { ttml, kind: attempt.kind };
      } catch (error) {
        lastError = error;
        if (error instanceof AppleApiError && error.isUnauthorized) throw error;
      }
    }
    if (lastError) throw lastError;
    throw new AppleApiError("该曲目没有可用歌词", { status: 404 });
  }

  async requestTTML(path) {
    const url = new URL(path, API_ORIGIN);
    url.searchParams.set("extend", "ttml");
    url.searchParams.set("format", "ttml");
    url.searchParams.set("l", "zh-Hans-CN");
    const response = await request(url.toString(), {
      headers: {
        Authorization: `Bearer ${await this.ensureDeveloperToken()}`,
        "Media-User-Token": this.mediaUserToken,
        Accept: "application/json, text/plain, */*"
      }
    });
    const text = await response.text();
    if (!response.ok) {
      let detail;
      try {
        detail = JSON.parse(text)?.errors?.[0];
      } catch {
        /* 忽略解析失败，使用状态码兜底 */
      }
      throw new AppleApiError(detail?.detail || `HTTP ${response.status}`, {
        status: response.status,
        code: detail?.code,
        path
      });
    }
    if (!text) return null;
    if (text.trimStart().startsWith("<")) return text;
    try {
      const body = JSON.parse(text);
      return body?.data?.[0]?.attributes?.ttml ?? null;
    } catch {
      return null;
    }
  }
}

/**
 * 统一曲目结构。
 * 资料库条目（library-songs）的真实曲库 ID 在 relationships.catalog 里，
 * 未开启 include=catalog 时退化为 null，由上层决定是否走搜索兜底。
 */
function normalizeSong(item, source) {
  const attributes = item?.attributes ?? {};
  const catalog = item?.relationships?.catalog?.data?.[0];
  const isLibraryItem = String(item?.type ?? "").startsWith("library-");
  const catalogId = catalog?.id
    ? String(catalog.id)
    : isLibraryItem
      ? null
      : String(item?.id ?? "") || null;
  return {
    id: catalogId,
    libraryId: isLibraryItem ? item.id : null,
    name: attributes.name ?? catalog?.attributes?.name ?? "未知曲目",
    artist: attributes.artistName ?? catalog?.attributes?.artistName ?? "",
    album: attributes.albumName ?? catalog?.attributes?.albumName ?? "",
    durationInMillis: attributes.durationInMillis ?? catalog?.attributes?.durationInMillis ?? null,
    hasLyrics: attributes.hasLyrics ?? catalog?.attributes?.hasLyrics ?? null,
    isrc: attributes.isrc ?? catalog?.attributes?.isrc ?? null,
    artworkUrl: attributes.artwork?.url ?? catalog?.attributes?.artwork?.url ?? null,
    source
  };
}

export { normalizeSong };
