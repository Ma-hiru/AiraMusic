/**
 * 批量抓取调度与落盘。
 *
 * 输出结构与 amll-ttml-db 保持一致，便于直接复用播放器里已有的加载逻辑：
 *   ttml/ncm-lyrics/{网易云ID}.ttml
 *   ttml/ncm-lyrics/index.jsonl        ← 同 amll-ttml-db 的索引格式
 *   ttml/apple-map.json                ← Apple ID ↔ 网易云 ID 映射，供增量更新复用
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { alignTranslation, buildAMLLTTML, parseAppleTTML } from "./amll-ttml.mjs";
import { resolveNeteaseSong } from "./netease.mjs";
import { resolveQQTranslation } from "./qq.mjs";

export const LYRICS_DIR = "ncm-lyrics";
export const INDEX_FILE = "index.jsonl";
export const MAP_FILE = "apple-map.json";

/** 署名信息，写入索引的 ttmlAuthor* 字段 */
const AUTHOR = { github: "149807805", login: "Ma-hiru" };

export function lyricsDir(rootDir) {
  return join(rootDir, LYRICS_DIR);
}

export async function ensureOutDir(rootDir) {
  await mkdir(lyricsDir(rootDir), { recursive: true });
  return lyricsDir(rootDir);
}

export async function readIndex(rootDir) {
  try {
    const raw = await readFile(join(lyricsDir(rootDir), INDEX_FILE), "utf8");
    const map = new Map();
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry?.id) map.set(String(entry.id), entry);
      } catch {
        /* 单行坏掉不影响整体 */
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function writeIndex(rootDir, index) {
  const entries = [...index.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  await writeFile(
    join(lyricsDir(rootDir), INDEX_FILE),
    entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : ""),
    "utf8"
  );
  return entries.length;
}

export async function readMap(rootDir) {
  try {
    return JSON.parse(await readFile(join(rootDir, MAP_FILE), "utf8"));
  } catch {
    return {};
  }
}

export async function writeMap(rootDir, map) {
  await mkdir(rootDir, { recursive: true });
  await writeFile(join(rootDir, MAP_FILE), JSON.stringify(map, null, 2), "utf8");
}

async function exists(file) {
  try {
    const info = await stat(file);
    return info.size > 0;
  } catch {
    return false;
  }
}

function buildIndexEntry({ ncmId, apple, stats, translationSource }) {
  return {
    id: String(ncmId),
    metadata: [
      ["album", [apple.album ?? ""]],
      ["artists", [apple.artist ?? ""]],
      ["musicName", [apple.name ?? ""]],
      ["ncmMusicId", [String(ncmId)]],
      ["appleMusicId", [String(apple.id)]],
      ["ttmlAuthorGithub", [AUTHOR.github]],
      ["ttmlAuthorGithubLogin", [AUTHOR.login]],
      ["lineCount", [String(stats.lines)]],
      ["translation", [translationSource]]
    ]
  };
}

/**
 * @param {object} options
 * @param {import("./apple.mjs").AppleMusicClient} options.client
 * @param {Array<object>} options.songs Apple 侧曲目
 * @param {string} options.rootDir 仓库内的 ttml/ 目录
 * @param {number} [options.concurrency]
 * @param {boolean} [options.force]
 * @param {boolean} [options.translate] 是否拼接翻译
 * @param {(event: object) => void} [options.onProgress]
 */
export async function collect({
  client,
  songs,
  rootDir,
  concurrency = 2,
  force = false,
  translate = true,
  onProgress = () => {},
  signal
}) {
  const dir = await ensureOutDir(rootDir);
  const index = await readIndex(rootDir);
  const mapping = await readMap(rootDir);

  const queue = [...songs];
  const stats = {
    total: songs.length,
    saved: 0,
    skipped: 0,
    missing: 0,
    unmapped: 0,
    failed: 0,
    translated: 0,
    unauthorized: false
  };

  const emit = (event) => {
    try {
      onProgress(event);
    } catch {
      /* 进度回调不应影响抓取 */
    }
  };

  async function worker() {
    while (queue.length > 0) {
      if (signal?.aborted || stats.unauthorized) return;
      const apple = queue.shift();

      try {
        const cached = mapping[String(apple.id)];
        const cachedFile = cached?.ncmId ? join(dir, `${cached.ncmId}.ttml`) : null;
        if (!force && cachedFile && (await exists(cachedFile))) {
          stats.skipped++;
          emit({
            type: "item",
            id: cached.ncmId,
            appleId: apple.id,
            song: apple,
            status: "skipped"
          });
          continue;
        }

        const { ttml: raw, kind } = await client.getLyrics(apple.id);
        const parsed = parseAppleTTML(raw);
        if (parsed.untimed) {
          stats.missing++;
          emit({
            type: "item",
            id: apple.id,
            song: apple,
            status: "missing",
            reason: "无时间轴歌词"
          });
          continue;
        }

        const netease = await resolveNeteaseSong(apple).catch(() => null);
        const ncmId = netease?.id ?? cached?.ncmId ?? null;
        if (!ncmId) {
          stats.unmapped++;
          emit({
            type: "item",
            id: apple.id,
            song: apple,
            status: "unmapped",
            reason: "未匹配到网易云曲目"
          });
          continue;
        }

        // 翻译优先级：QQ 音乐优先，网易云按行兜底，最后才是 Apple 自带
        let translations = new Map();
        let translationSource = "none";
        let qqMatch = null;
        if (translate) {
          qqMatch = await resolveQQTranslation(apple).catch(() => null);
          const qqMap = qqMatch?.entries?.length
            ? alignTranslation(parsed.lines, qqMatch.entries)
            : new Map();
          const neMap = netease?.translationEntries?.length
            ? alignTranslation(parsed.lines, netease.translationEntries)
            : new Map();

          // QQ 打底，网易云补齐 QQ 缺失的行
          translations = new Map(neMap);
          for (const [key, value] of qqMap) translations.set(key, value);

          if (qqMap.size > 0) translationSource = neMap.size > qqMap.size ? "qq+netease" : "qq";
          else if (neMap.size > 0) translationSource = "netease";
        }
        if (translations.size === 0 && parsed.appleTranslations.size > 0) {
          translations = new Map(
            [...parsed.appleTranslations.entries()].map(([key, value]) => [key, value.text])
          );
          if (translations.size > 0) translationSource = "apple";
        }

        const { ttml, stats: ttmlStats } = buildAMLLTTML({
          parsed,
          meta: {
            ncmMusicId: ncmId,
            appleMusicId: String(apple.id),
            musicName: apple.name,
            artists: apple.artist,
            album: apple.album,
            translationSource,
            ttmlAuthorGithub: AUTHOR.github,
            ttmlAuthorGithubLogin: AUTHOR.login
          },
          translations
        });

        const file = join(dir, `${ncmId}.ttml`);
        await writeFile(file, ttml, "utf8");

        mapping[String(apple.id)] = {
          ncmId: String(ncmId),
          name: apple.name,
          artist: apple.artist,
          matchedName: netease?.name ?? null,
          matchedArtists: netease?.artists ?? null,
          score: netease?.score ?? null,
          qqId: qqMatch?.matched?.id ?? null,
          qqMid: qqMatch?.matched?.mid ?? null,
          translationSource,
          matchedAt: new Date().toISOString()
        };
        index.set(
          String(ncmId),
          buildIndexEntry({ ncmId, apple, stats: ttmlStats, translationSource })
        );

        stats.saved++;
        if (translations.size > 0) stats.translated++;
        emit({
          type: "item",
          id: ncmId,
          appleId: apple.id,
          song: apple,
          status: "saved",
          endpoint: kind,
          entry: { ...ttmlStats, translationSource, bytes: Buffer.byteLength(ttml) }
        });
      } catch (error) {
        if (error?.isUnauthorized) {
          stats.unauthorized = true;
          emit({ type: "auth-error", message: error.message });
          return;
        }
        if (error?.isMissing) {
          stats.missing++;
          emit({ type: "item", id: apple.id, song: apple, status: "missing", reason: "无歌词" });
          continue;
        }
        stats.failed++;
        emit({
          type: "item",
          id: apple.id,
          song: apple,
          status: "failed",
          reason: error?.message ?? String(error)
        });
      }
    }
  }

  emit({ type: "start", total: stats.total });
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  await writeIndex(rootDir, index);
  await writeMap(rootDir, mapping);
  emit({ type: "done", stats });
  return stats;
}
