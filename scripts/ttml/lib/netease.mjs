/**
 * 网易云音乐公开接口：用于把 Apple 曲目映射到网易云 ID，并取回翻译歌词。
 * 只用到匿名可访问的端点，不需要登录 Cookie。
 */

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Referer: "https://music.163.com/",
  Cookie: "appver=8.9.70; os=pc"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 网易云对匿名调用限流很紧：串行 + 最小间隔，一旦收到 406 就进入全局冷却，
 * 冷却期内所有请求排队等待，避免越试越封。
 */
const MIN_GAP = 1800;
const COOLDOWN = 45_000;
let queue = Promise.resolve();
let lastCallAt = 0;
let blockedUntil = 0;

function scheduled(task) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_GAP - Date.now(), blockedUntil - Date.now());
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

async function requestJSON(url, { retry = 5, timeout = 15000 } = {}) {
  return scheduled(async () => {
    let lastError = null;
    for (let attempt = 0; attempt < retry; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(url, { headers: HEADERS, signal: controller.signal });
        const body = await response.json().catch(() => null);
        if (body?.code === 406) {
          blockedUntil = Date.now() + COOLDOWN;
          lastError = new Error("网易云限流");
          continue;
        }
        if (response.status === 429 || response.status >= 500) {
          blockedUntil = Date.now() + 10_000;
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        return body ?? {};
      } catch (error) {
        lastError = error;
        await sleep(800 * (attempt + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError ?? new Error("网易云请求失败");
  });
}

/** 归一化歌名，便于跨平台比对 */
export function normalizeTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\((?:\s*)(?:feat|ft|with)[^)]*\)/g, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[!-/:-@[-`{-~、。，．・：；？！「」『』【】（）]/g, "")
    .replace(/[（(].*?[）)]/g, "");
}

function splitArtists(value) {
  return String(value ?? "")
    .split(/[,&/、×]| feat\.? | ft\.? /i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const METADATA_LINE_RE =
  /^(作词|作曲|编曲|制作人|出品|监制|混音|母带|录音|和声|吉他|贝斯|鼓|键盘|弦乐|OP|SP|词|曲)\s*[:：]/i;

/** 解析 LRC，丢弃制作人员信息行 */
export function parseLRC(content) {
  if (!content) return [];
  const entries = [];
  for (const raw of String(content).split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!text || METADATA_LINE_RE.test(text)) continue;
    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(String(stamp[2]).replace(":", "."));
      entries.push({ time: Math.round((minutes * 60 + seconds) * 1000), text });
    }
  }
  return entries.sort((a, b) => a.time - b.time);
}

const searchCache = new Map();

export async function searchSongs(term, { limit = 20 } = {}) {
  const cacheKey = `${term}#${limit}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);
  const result = await searchSongsUncached(term, limit);
  searchCache.set(cacheKey, result);
  return result;
}

function normalizeCandidate(song) {
  // /api/search/get 用 artists/album/duration，/api/cloudsearch/pc 用 ar/al/dt
  const artists = (song.artists ?? song.ar ?? []).map((artist) => artist.name);
  return {
    id: String(song.id),
    name: song.name,
    artists,
    album: song.album?.name ?? song.al?.name ?? "",
    duration: song.duration ?? song.dt ?? null,
    transNames: song.transNames ?? [],
    alias: song.alias ?? []
  };
}

async function searchSongsUncached(term, limit) {
  const query = `s=${encodeURIComponent(term)}&type=1&offset=0&limit=${limit}`;
  // 两个端点限流策略不同，互为备份
  for (const endpoint of ["/api/search/get", "/api/cloudsearch/pc"]) {
    try {
      const body = await requestJSON(`https://music.163.com${endpoint}?${query}`);
      const songs = body?.result?.songs ?? [];
      if (songs.length > 0) return songs.map(normalizeCandidate);
    } catch {
      /* 换下一个端点 */
    }
  }
  return [];
}

export async function getLyric(ncmId) {
  const url = `https://music.163.com/api/song/lyric?id=${ncmId}&lv=-1&tv=-1&rv=-1`;
  const body = await requestJSON(url);
  return {
    lrc: body?.lrc?.lyric ?? "",
    translation: body?.tlyric?.lyric ?? "",
    roman: body?.romalrc?.lyric ?? ""
  };
}

/**
 * 在候选里挑最像的一首。歌名权重最高，其次歌手重合度与时长差。
 * 返回 null 表示没有足够可信的匹配。
 */
export function pickCandidate(apple, candidates) {
  const title = normalizeTitle(apple.name);
  const appleArtists = new Set(splitArtists(apple.artist));
  const appleDuration = apple.durationInMillis ?? null;

  let best = null;
  for (const candidate of candidates) {
    // 日文歌在网易云常见「原名 + 罗马音别名」，两边都要比
    const titles = [candidate.name, ...(candidate.transNames ?? []), ...(candidate.alias ?? [])]
      .map(normalizeTitle)
      .filter(Boolean);

    let titleScore = 0;
    if (titles.some((item) => item === title)) titleScore = 50;
    else if (titles.some((item) => item.includes(title) || title.includes(item))) titleScore = 22;

    const candidateArtists = new Set(candidate.artists.flatMap((name) => splitArtists(name)));
    let overlap = 0;
    for (const artist of appleArtists) if (candidateArtists.has(artist)) overlap++;
    const artistScore = Math.min(30, overlap * 24);

    let durationScore = 0;
    if (appleDuration && candidate.duration) {
      const diff = Math.abs(appleDuration - candidate.duration);
      if (diff <= 1500) durationScore = 30;
      else if (diff <= 3000) durationScore = 18;
      else if (diff <= 8000) durationScore = 8;
      else if (diff > 15000) durationScore = -10;
    }

    // 名字完全对不上时必须靠"同歌手 + 时长几乎一致"兜底，否则视为不可信
    if (titleScore === 0 && !(overlap >= 1 && durationScore >= 30)) continue;

    const score = titleScore + artistScore + durationScore;
    if (!best || score > best.score) best = { ...candidate, score };
  }

  if (!best || best.score < 55) return null;
  return best;
}

/** Apple 曲目 → 网易云曲目（含翻译），一步到位 */
export async function resolveNeteaseSong(apple) {
  const firstArtist =
    String(apple.artist ?? "")
      .split(/[,&/、×]/)[0]
      ?.trim() ?? "";
  const queries = [
    `${apple.name} ${firstArtist}`.trim(),
    apple.album ? `${apple.album} ${firstArtist}`.trim() : null,
    // 日文歌的罗马音标题常常搜不到，最后按歌手兜底（只认时长几乎一致的候选）
    firstArtist || null
  ].filter((item, index, all) => item && all.indexOf(item) === index);

  let matched = null;
  for (const query of queries) {
    matched = pickCandidate(apple, await searchSongs(query));
    if (matched) break;
  }
  if (!matched) return null;
  const lyric = await getLyric(matched.id);
  return {
    ...matched,
    translationEntries: parseLRC(lyric.translation),
    hasTranslation: Boolean(lyric.translation)
  };
}
