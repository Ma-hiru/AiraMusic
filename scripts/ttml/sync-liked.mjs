/**
 * 把网易云「我喜欢的音乐」批量补成 TTML。
 *
 *   node scripts/ttml/sync-liked.mjs --limit 20 --dry-run   # 只看匹配结果
 *   node scripts/ttml/sync-liked.mjs --limit 20            # 真抓
 *   node scripts/ttml/sync-liked.mjs --all                 # 处理全部缺口
 *
 * 流程：网易云 ID 已知 → Apple 曲库反查 → 抓 Apple TTML → 拼翻译 → 落盘
 * 翻译优先级：QQ 音乐 → 网易云（直接用已知 ID 取 tlyric）→ Apple 自带
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AppleMusicClient,
  AuthStore,
  decodeTokenExpiry,
  fetchDeveloperToken
} from "./lib/apple.mjs";
import {
  alignRomanization,
  alignTranslation,
  buildAMLLTTML,
  parseAppleTTML
} from "./lib/amll-ttml.mjs";
import { lyricsDir, readIndex, writeIndex } from "./lib/collect.mjs";
import { getLyric as getNeteaseLyric, parseLRC as parseNeteaseLRC } from "./lib/netease.mjs";
import { resolveQQTranslation } from "./lib/qq.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const OUT_DIR = join(REPO_ROOT, "ttml");
const AUTH_FILE = join(HERE, ".auth.json");
const LIKED_FILE = join(OUT_DIR, "liked-songs.json");
const AMLL_INDEX_URL =
  "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics/index.jsonl";
const REPORT_FILE = join(OUT_DIR, "sync-liked-report.json");

function parseArgs(argv) {
  const args = { limit: 20, dryRun: false, concurrency: 2, all: false };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (key === "dry-run") args.dryRun = true;
    else if (key === "include-amll") args.includeAmll = true;
    else if (key === "all") args.all = true;
    else if (next && !next.startsWith("--")) {
      args[key] = key === "limit" || key === "concurrency" ? Number(next) : next;
      index++;
    }
  }
  return args;
}

const normalizeTitle = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\((?:\s*)(?:feat|ft|with)[^)]*\)/g, "")
    .replace(/[\s\u3000]+/g, "")
    .replace(/[!-/:-@[-`{-~、。，．・：；？！「」『』【】（）]/g, "")
    .replace(/[（(].*?[）)]/g, "");

const splitArtists = (value) =>
  String(value ?? "")
    .split(/[,&/、×]| feat\.? | ft\.? /i)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

/** Apple 搜索对 × / 括号之类的符号不友好，先清理 */
function buildQuery(value) {
  return String(value ?? "")
    .replace(/[×÷✕✖]/g, " ")
    .replace(/[（(【\[].*?[）)】\]]/g, " ")
    .replace(/[!-/:-@[-`{-~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 网易云曲目 → Apple 候选打分。
 *
 * 日文歌在 Apple 侧常被罗马音化（リナリア → Linaria），歌名和歌手都对不上，
 * 所以额外允许"时长几乎一致且唯一"的候选直接命中。
 */
function pickAppleSong(track, candidates) {
  const title = normalizeTitle(track.name);
  const artists = new Set(splitArtists(track.artist));
  let best = null;

  for (const candidate of candidates) {
    const candidateTitle = normalizeTitle(candidate.name);
    let titleScore = 0;
    if (candidateTitle === title) titleScore = 50;
    else if (candidateTitle.includes(title) || title.includes(candidateTitle)) titleScore = 22;

    const candidateArtists = new Set(splitArtists(candidate.artist));
    let overlap = 0;
    for (const artist of artists) if (candidateArtists.has(artist)) overlap++;
    // 单个歌手对上给 26：配合"时长几乎一致"（+30）刚好能过 55 的门槛
    const artistScore = Math.min(30, overlap * 26);

    let durationScore = 0;
    if (track.duration && candidate.durationInMillis) {
      const diff = Math.abs(track.duration - candidate.durationInMillis);
      if (diff <= 1500) durationScore = 30;
      else if (diff <= 3000) durationScore = 18;
      else if (diff <= 8000) durationScore = 8;
      else if (diff > 15000) durationScore = -10;
    }

    if (titleScore === 0 && !(overlap >= 1 && durationScore >= 30)) continue;

    const score = titleScore + artistScore + durationScore;
    if (!best || score > best.score) best = { ...candidate, score };
  }

  if (best && best.score >= 55) return best;

  // 名字完全对不上时的兜底：时长差 ≤0.5s 且全场唯一
  // 阈值不能再放宽：实测 DECO*27 的《ハオ》180843ms 与《The Vampire》180000ms 只差 843ms
  if (track.duration) {
    const near = candidates
      .map((candidate) => ({
        candidate,
        diff: Math.abs(track.duration - (candidate.durationInMillis ?? 0))
      }))
      .filter((item) => item.candidate.durationInMillis && item.diff <= 500);
    if (near.length === 1) {
      return { ...near[0].candidate, score: 56, durationOnly: true };
    }
  }

  return null;
}

const AMLL_CACHE = join(OUT_DIR, ".amll-index.jsonl");

/** amll-ttml-db 已收录的网易云 ID，避免重复造轮子（优先读本地缓存） */
async function loadAmllIds() {
  try {
    const response = await fetch(AMLL_INDEX_URL, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    await writeFile(AMLL_CACHE, text, "utf8").catch(() => {});
    const ids = new Set();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry?.id) ids.add(String(entry.id));
      } catch {
        /* 跳过坏行 */
      }
    }
    return ids;
  } catch {
    try {
      const text = await readFile(AMLL_CACHE, "utf8");
      const ids = new Set();
      for (const line of text.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry?.id) ids.add(String(entry.id));
        } catch {
          /* 跳过坏行 */
        }
      }
      return ids;
    } catch {
      return new Set();
    }
  }
}

async function loadContext() {
  const store = new AuthStore(AUTH_FILE);
  const auth = await store.load();
  if (!auth?.mediaUserToken) throw new Error("尚未授权，请先运行 server.mjs 并完成授权");

  let developerToken = auth.developerToken;
  if (!developerToken || (auth.developerTokenExpiry ?? 0) < Date.now() + 86_400_000) {
    developerToken = await fetchDeveloperToken();
    await store.save({ developerToken, developerTokenExpiry: decodeTokenExpiry(developerToken) });
  }

  const client = new AppleMusicClient({
    mediaUserToken: auth.mediaUserToken,
    developerToken,
    storefront: auth.storefront || "cn"
  });
  await client.verifyAuth();

  const liked = JSON.parse(await readFile(LIKED_FILE, "utf8")).songs ?? [];
  const local = new Set(
    (await readdir(lyricsDir(OUT_DIR)))
      .filter((f) => f.endsWith(".ttml"))
      .map((f) => f.slice(0, -5))
  );
  const amll = await loadAmllIds();

  return { client, liked, local, amll };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { client, liked, local, amll } = await loadContext();

  const pending = liked.filter(
    (track) => !local.has(String(track.id)) && (args.includeAmll || !amll.has(String(track.id)))
  );
  console.log(
    `amll-ttml-db 已收录 ${amll.size} 个 ID，其中命中红心 ${liked.length - pending.length - local.size > 0 ? liked.filter((t) => amll.has(String(t.id))).length : 0} 首`
  );
  const targets = args.all ? pending : pending.slice(0, args.limit);

  console.log(
    `红心 ${liked.length} 首，本地已有 ${local.size}，待补 ${pending.length}，本次处理 ${targets.length}`
  );
  if (args.dryRun) console.log("（dry-run：不写文件）\n");

  const report = [];
  const index = await readIndex(OUT_DIR);
  const stats = {
    saved: 0,
    skipped: 0,
    noLyric: 0,
    unmatched: 0,
    deferred: 0,
    failed: 0,
    translated: 0
  };
  const queue = [...targets];

  async function worker() {
    while (queue.length > 0) {
      const track = queue.shift();
      const record = { ncmId: track.id, name: track.name, artist: track.artist };
      try {
        const firstArtist =
          String(track.artist)
            .split(/[,&/、×]/)[0]
            ?.trim() ?? "";
        const queries = [
          `${buildQuery(track.name)} ${buildQuery(firstArtist)}`.trim(),
          `${buildQuery(track.album)} ${buildQuery(firstArtist)}`.trim()
        ].filter((item, index, all) => item && all.indexOf(item) === index);

        let matched = null;
        let searchError = null;
        for (const query of queries) {
          try {
            const candidates = await client.searchCandidates(query);
            matched = pickAppleSong(track, candidates);
          } catch (error) {
            // 429/网络错误不能当成"Apple 没有这首歌"，否则会静默漏歌
            searchError = error;
          }
          if (matched) break;
        }
        if (!matched && searchError) {
          stats.deferred++;
          report.push({ ...record, status: "deferred", error: searchError.message });
          console.log(
            `… ${track.name} — ${track.artist}（Apple ${searchError.status ?? ""} 稍后重试）`
          );
          continue;
        }
        if (!matched?.id) {
          stats.unmatched++;
          report.push({ ...record, status: "unmatched" });
          console.log(`? ${track.name} — ${track.artist}（Apple 无匹配）`);
          continue;
        }

        record.appleId = matched.id;
        record.appleName = matched.name;
        record.appleScore = matched.score;

        const { ttml: raw, kind } = await client.getLyrics(matched.id);
        const parsed = parseAppleTTML(raw);
        if (parsed.untimed) {
          stats.noLyric++;
          report.push({ ...record, status: "no-lyric", error: "Apple 只给了无时间轴歌词" });
          console.log(`- ${track.name} — ${track.artist}（Apple 无时间轴）`);
          continue;
        }

        const qq = await resolveQQTranslation({
          name: track.name,
          artist: track.artist,
          album: track.album,
          durationInMillis: track.duration
        }).catch(() => null);
        const qqMap = qq?.entries?.length ? alignTranslation(parsed.lines, qq.entries) : new Map();

        const neRaw = await getNeteaseLyric(track.id).catch(() => null);
        const neEntries = parseNeteaseLRC(neRaw?.translation);
        const neMap = neEntries.length ? alignTranslation(parsed.lines, neEntries) : new Map();

        let translations = new Map(neMap);
        for (const [key, value] of qqMap) translations.set(key, value);
        let source =
          qqMap.size > 0
            ? neMap.size > qqMap.size
              ? "qq+netease"
              : "qq"
            : neMap.size > 0
              ? "netease"
              : "none";

        if (translations.size === 0 && parsed.appleTranslations.size > 0) {
          translations = new Map(
            [...parsed.appleTranslations].map(([key, value]) => [key, value.text])
          );
          if (translations.size > 0) source = "apple";
        }

        // 逐字罗马音：只有日文歌、且 QQ 返回了逐字 roma 才拼
        let transliterations = new Map();
        if (
          String(parsed.lang ?? "")
            .toLowerCase()
            .startsWith("ja") &&
          qq?.romanLines?.length
        ) {
          transliterations = alignRomanization(parsed.lines, qq.romanLines);
        }

        const { ttml, stats: ttmlStats } = buildAMLLTTML({
          parsed,
          meta: {
            ncmMusicId: String(track.id),
            appleMusicId: String(matched.id),
            musicName: track.name,
            artists: track.artist,
            album: track.album,
            translationSource: source,
            ttmlAuthorGithub: "149807805",
            ttmlAuthorGithubLogin: "Ma-hiru"
          },
          translations,
          transliterations
        });

        if (!args.dryRun) {
          await writeFile(join(lyricsDir(OUT_DIR), `${track.id}.ttml`), ttml, "utf8");
          index.set(String(track.id), {
            id: String(track.id),
            metadata: [
              ["album", [track.album ?? ""]],
              ["artists", [track.artist ?? ""]],
              ["musicName", [track.name ?? ""]],
              ["ncmMusicId", [String(track.id)]],
              ["appleMusicId", [String(matched.id)]],
              ["ttmlAuthorGithub", ["149807805"]],
              ["ttmlAuthorGithubLogin", ["Ma-hiru"]],
              ["lineCount", [String(ttmlStats.lines)]],
              ["translation", [source]]
            ]
          });
          stats.saved++;
          if (translations.size > 0) stats.translated++;
        }

        report.push({
          ...record,
          status: args.dryRun ? "matched" : "saved",
          endpoint: kind,
          lines: ttmlStats.lines,
          translations: translations.size,
          translationSource: source,
          romanLines: ttmlStats.transliterations
        });
        console.log(
          `✓ ${track.name} — ${track.artist}  →  ${matched.name} (${matched.score})  ${ttmlStats.lines}行 / 译${translations.size} / ${source}${ttmlStats.transliterations ? ` / 罗马音${ttmlStats.transliterations}` : ""}`
        );
      } catch (error) {
        if (error?.isMissing) {
          stats.noLyric++;
          report.push({ ...record, status: "no-lyric" });
          console.log(`- ${track.name} — ${track.artist}（Apple 无歌词）`);
          continue;
        }
        stats.failed++;
        report.push({ ...record, status: "failed", error: error?.message ?? String(error) });
        console.log(`× ${track.name} — ${track.artist}：${error?.message ?? error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, () => worker()));

  console.log(
    `\n完成：保存 ${stats.saved}，无歌词 ${stats.noLyric}，未匹配 ${stats.unmatched}，限流延期 ${stats.deferred}，失败 ${stats.failed}，带翻译 ${stats.translated}`
  );

  if (!args.dryRun) {
    await writeIndex(OUT_DIR, index);
    let previous = [];
    try {
      previous = JSON.parse(await readFile(REPORT_FILE, "utf8")).items ?? [];
    } catch {
      previous = [];
    }
    const merged = new Map(previous.map((item) => [String(item.ncmId), item]));
    for (const item of report) merged.set(String(item.ncmId), item);
    await writeFile(
      REPORT_FILE,
      JSON.stringify(
        { updatedAt: new Date().toISOString(), total: merged.size, items: [...merged.values()] },
        null,
        2
      ),
      "utf8"
    );
  }
}

main().catch((error) => {
  console.error("执行失败：", error?.message ?? error);
  process.exitCode = 1;
});
