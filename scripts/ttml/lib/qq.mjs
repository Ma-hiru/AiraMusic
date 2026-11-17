/**
 * QQ 音乐：翻译歌词的首选来源。
 *
 * 只用到匿名可访问的 musicu.fcg 接口，不需要登录 Cookie：
 * - 搜索：music.search.SearchCgiService / DoSearchForQQMusicDesktop
 * - 歌词：music.musichallSong.PlayLyricInfo / GetPlayLyricInfo（crypt=1 返回加密 QRC）
 *
 * QQ 的翻译、罗马音同样可能是 QRC 密文，用 qrc-decoder 解密后再按 LRC 解析。
 */
import { createRequire } from "node:module";

import { parseQrc } from "@applemusic-like-lyrics/lyric";

import { normalizeTitle } from "./netease.mjs";

const require = createRequire(import.meta.url);
const { decryptQrc } = require("qrc-decoder");

const HEADERS = {
  "Content-Type": "application/json;charset=UTF-8",
  Referer: "https://y.qq.com/",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastCallAt = 0;
const MIN_GAP = 700;
let queue = Promise.resolve();

function scheduled(task) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_GAP - Date.now());
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

async function musicu(body, { retry = 3 } = {}) {
  return scheduled(async () => {
    for (let attempt = 0; attempt < retry; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("https://u.y.qq.com/cgi-bin/musicu.fcg", {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        if (attempt === retry - 1) throw error;
        await sleep(900 * (attempt + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error("QQ 音乐请求失败");
  });
}

const textToBase64 = (text) => Buffer.from(String(text ?? ""), "utf8").toString("base64");

/** 解密 QQ 返回的歌词字段：hex 密文走 decryptQrc，明文原样返回 */
export function decodeQQField(value) {
  if (typeof value !== "string" || !value) return "";
  const text = value.trim();
  if (/^[0-9a-fA-F]+$/.test(text) && text.length % 2 === 0) {
    try {
      return decryptQrc(text);
    } catch {
      return text;
    }
  }
  return text;
}

const METADATA_LINE_RE =
  /^(作词|作曲|编曲|制作人|出品|监制|混音|母带|录音|和声|吉他|贝斯|鼓|键盘|弦乐|OP|SP|词|曲|Lyrics|Composer|Arranger)\s*[:：]/i;

/** QQ 的翻译里混着版权声明和占位符，不参与对齐 */
const NOISE_LINE_RE = /^(?:\/\/+|\\+|[.。·\s]+)$|TME|翻译作品|享有本|版权归|未经许可/i;

/**
 * QQ 的 roma / trans 有时被包在 `<QrcInfos><Lyric_1 LyricContent="..."/>` 里，
 * 属性值是转义过的整段 QRC/LRC 文本。
 */
export function unwrapQrcXml(value) {
  if (typeof value !== "string" || !value.includes("<QrcInfos")) return value ?? "";
  const matched = value.match(/LyricContent="([\s\S]*?)"\s*\/>/);
  if (!matched) return "";
  return matched[1]
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** 罗马音：解包成 QRC 后按逐字解析，返回 AMLL 的 LyricLine[] */
export function parseQrcText(text) {
  const content = unwrapQrcXml(text);
  if (!content || !/\[\d+,\d+\]/.test(content)) return [];
  try {
    return parseQrc(content).filter((line) => line.words.length > 0);
  } catch {
    return [];
  }
}

/** LRC → [{time, text}]，丢掉制作人员行 */
export function parseLRC(content) {
  if (!content) return [];
  const entries = [];
  for (const raw of String(content).split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d+(?:[.:]\d+)?)\]/g)];
    if (stamps.length === 0) continue;
    const text = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!text || METADATA_LINE_RE.test(text) || NOISE_LINE_RE.test(text)) continue;
    for (const stamp of stamps) {
      const minutes = Number(stamp[1]);
      const seconds = Number(String(stamp[2]).replace(":", "."));
      entries.push({ time: Math.round((minutes * 60 + seconds) * 1000), text });
    }
  }
  return entries.sort((a, b) => a.time - b.time);
}

async function searchModern(term, limit) {
  const module = "music.search.SearchCgiService";
  const json = await musicu({
    [module]: {
      module,
      method: "DoSearchForQQMusicDesktop",
      param: { search_type: 0, query: term, page_num: 1, num_per_page: limit }
    }
  });
  const block = json?.[module];
  if (json?.code !== 0 || block?.code !== 0) return [];
  return (block?.data?.body?.song?.list ?? []).map((song) => ({
    id: song.id ?? song.songid,
    mid: song.mid ?? song.songmid,
    title: song.title ?? song.songname ?? "",
    interval: song.interval ?? null,
    artists: (song.singer ?? []).map((item) => item.name).filter(Boolean),
    album: song.album?.name ?? ""
  }));
}

/** 老 Web 搜索：musicu 在境外 IP 返回空列表（code 2001），这条线路不受影响 */
async function searchLegacy(term, limit) {
  const url = new URL("https://c.y.qq.com/soso/fcgi-bin/search_for_qq_cp");
  url.searchParams.set("w", term);
  url.searchParams.set("p", "1");
  url.searchParams.set("n", String(limit));
  url.searchParams.set("format", "json");
  url.searchParams.set("t", "0");
  url.searchParams.set("platform", "yqq");
  url.searchParams.set("needNewCode", "1");

  return scheduled(async () => {
    const response = await fetch(url, {
      headers: { Referer: "https://y.qq.com/", "User-Agent": HEADERS["User-Agent"] }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    if (json?.code !== 0) return [];
    return (json?.data?.song?.list ?? []).map((song) => ({
      id: song.songid,
      mid: song.songmid,
      title: song.songname ?? "",
      interval: song.interval ?? null,
      artists: (song.singer ?? []).map((item) => item.name).filter(Boolean),
      album: song.albumname ?? ""
    }));
  });
}

export async function searchSongs(term, { limit = 10 } = {}) {
  const legacy = await searchLegacy(term, limit).catch(() => []);
  if (legacy.length > 0) return legacy;
  return searchModern(term, limit).catch(() => []);
}

/** 拉取单曲的翻译 / 罗马音（已解密，仍是 LRC 文本） */
export async function getQQLyric(song) {
  const json = await musicu({
    comm: { ct: 24, cv: 0, uin: "0", format: "json" },
    lyric: {
      module: "music.musichallSong.PlayLyricInfo",
      method: "GetPlayLyricInfo",
      param: {
        songID: song.id,
        songMID: song.mid,
        crypt: 1,
        lrc_t: 0,
        qrc: 1,
        qrc_t: 0,
        trans: 1,
        trans_t: 0,
        roma: 1,
        roma_t: 0,
        ct: 19,
        cv: 2111,
        interval: song.interval ?? 0,
        songName: textToBase64(song.title),
        singerName: textToBase64(song.artists?.join("/") ?? ""),
        albumName: textToBase64(song.album ?? ""),
        type: 0
      }
    }
  });

  const block = json?.lyric;
  if (json?.code !== 0 || !block || block.code !== 0 || !block.data) return null;
  const translation = decodeQQField(block.data.trans);
  const roman = decodeQQField(block.data.roma);
  return {
    translation,
    roman,
    romanLines: parseQrcText(roman)
  };
}

const splitArtists = (value) =>
  String(value ?? "")
    .split(/[,&/、×]| feat\.? | ft\.? /i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/** 从 QQ 搜索结果里挑最像的一首 */
export function pickCandidate(apple, candidates) {
  const title = normalizeTitle(apple.name);
  const appleArtists = new Set(splitArtists(apple.artist));
  const appleDuration = apple.durationInMillis ?? null;

  let best = null;
  for (const candidate of candidates) {
    const candidateTitle = normalizeTitle(candidate.title);
    let titleScore = 0;
    if (candidateTitle === title) titleScore = 50;
    else if (candidateTitle.includes(title) || title.includes(candidateTitle)) titleScore = 22;

    const candidateArtists = new Set(candidate.artists.flatMap((name) => splitArtists(name)));
    let overlap = 0;
    for (const artist of appleArtists) if (candidateArtists.has(artist)) overlap++;
    const artistScore = Math.min(30, overlap * 24);

    let durationScore = 0;
    if (appleDuration && candidate.interval) {
      const diff = Math.abs(appleDuration - candidate.interval * 1000);
      if (diff <= 1500) durationScore = 30;
      else if (diff <= 3000) durationScore = 18;
      else if (diff <= 8000) durationScore = 8;
      else if (diff > 15000) durationScore = -10;
    }

    if (titleScore === 0 && !(overlap >= 1 && durationScore >= 30)) continue;

    const score = titleScore + artistScore + durationScore;
    if (!best || score > best.score) best = { ...candidate, score };
  }

  return best && best.score >= 55 ? best : null;
}

/** Apple 曲目 → QQ 翻译条目 */
export async function resolveQQTranslation(apple) {
  const firstArtist =
    String(apple.artist ?? "")
      .split(/[,&/、×]/)[0]
      ?.trim() ?? "";
  const queries = [
    `${apple.name} ${firstArtist}`.trim(),
    apple.album ? `${apple.album} ${firstArtist}`.trim() : null
  ].filter((item, index, all) => item && all.indexOf(item) === index);

  for (const query of queries) {
    const songs = await searchSongs(query).catch(() => []);
    const matched = pickCandidate(apple, songs);
    if (!matched) continue;

    const lyric = await getQQLyric(matched).catch(() => null);
    const entries = parseLRC(lyric?.translation);
    return {
      matched,
      entries,
      roman: lyric?.roman ?? "",
      romanLines: lyric?.romanLines ?? [],
      hasTranslation: entries.length > 0
    };
  }

  return null;
}
