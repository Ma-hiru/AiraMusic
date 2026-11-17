/**
 * 校验 ttml/ncm-lyrics 下的歌词文件。
 *
 *   node scripts/ttml/check.mjs                # 全量体检
 *   node scripts/ttml/check.mjs --id 1833299265 --dump   # 单曲详情
 *
 * 用播放器同款解析器（@applemusic-like-lyrics/lyric 1.x）解析，Node 端注入 jsdom 的 DOMParser。
 */
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

globalThis.DOMParser ??= new JSDOM().window.DOMParser;
const { parseTTML } = await import("@applemusic-like-lyrics/lyric");

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "../../ttml");
const LYRICS_DIR = join(OUT_DIR, "ncm-lyrics");

const args = process.argv.slice(2);
const idArg = args.indexOf("--id") > -1 ? args[args.indexOf("--id") + 1] : null;
const dump = args.includes("--dump");

async function loadIndex() {
  const map = new Map();
  try {
    const raw = await readFile(join(LYRICS_DIR, "index.jsonl"), "utf8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry?.id) map.set(String(entry.id), entry);
      } catch {
        /* 坏行跳过 */
      }
    }
  } catch {
    /* 没有索引也继续 */
  }
  return map;
}

function inspect(xml) {
  const result = parseTTML(xml);
  const lines = result.lines ?? [];
  const wordLines = lines.filter((line) => line.words.length > 1).length;
  const translated = lines.filter((line) => line.translatedLyric).length;
  const bg = lines.filter((line) => line.isBG).length;
  const duet = lines.filter((line) => line.isDuet).length;
  const zeroStart = lines.filter((line) => line.startTime === 0 && line.words.length > 1).length;
  const badOrder = lines.filter((line) => line.endTime < line.startTime).length;
  // Apple 有时只给无时间轴的纯文本，全为 0 的文件等于废文件
  const untimed = lines.length > 1 && lines.every((line) => line.startTime === 0);
  return {
    lines: lines.length,
    wordLines,
    translated,
    bg,
    duet,
    zeroStart,
    badOrder,
    untimed,
    duration: lines.reduce((max, line) => Math.max(max, line.endTime), 0)
  };
}

const index = await loadIndex();
const files = idArg
  ? [`${idArg}.ttml`]
  : (await readdir(LYRICS_DIR)).filter((file) => file.endsWith(".ttml")).sort();

const summary = {
  files: 0,
  parseFailed: 0,
  withTranslation: 0,
  fullyTranslated: 0,
  bgFiles: 0,
  duetFiles: 0,
  suspicious: 0,
  totalLines: 0
};
const problems = [];

for (const file of files) {
  const id = file.replace(/\.ttml$/, "");
  let xml;
  try {
    xml = await readFile(join(LYRICS_DIR, file), "utf8");
  } catch {
    console.log(`× ${file} 读取失败`);
    continue;
  }

  let info;
  try {
    info = inspect(xml);
  } catch (error) {
    summary.parseFailed++;
    problems.push({ id, reason: `解析失败：${error?.message ?? error}` });
    console.log(`× ${id} 解析失败：${error?.message ?? error}`);
    continue;
  }

  summary.files++;
  summary.totalLines += info.lines;
  if (info.translated > 0) summary.withTranslation++;
  if (info.lines > 0 && info.translated >= info.lines) summary.fullyTranslated++;
  if (info.bg > 0) summary.bgFiles++;
  if (info.duet > 0) summary.duetFiles++;

  const entry = index.get(id);
  const meta = entry
    ? Object.fromEntries(entry.metadata.map(([key, values]) => [key, values[0]]))
    : {};
  const issues = [];
  if (info.lines === 0) issues.push("无歌词行");
  if (info.badOrder > 0) issues.push(`${info.badOrder} 行时间倒挂`);
  if (info.untimed) issues.push("时间轴缺失（全为 0）");
  else if (info.zeroStart > 2) issues.push(`${info.zeroStart} 行从 0 秒开始`);
  if (issues.length > 0) {
    summary.suspicious++;
    problems.push({ id, reason: issues.join("；") });
  }

  if (idArg || dump) {
    console.log(
      `\n${id} ${meta.musicName ?? ""} — ${meta.artists ?? ""}\n` +
        `  Apple ${meta.appleMusicId ?? "?"} | ${info.lines} 行 / 逐字 ${info.wordLines} / 翻译 ${info.translated} / 和声 ${info.bg} / 对唱 ${info.duet}\n` +
        `  时长 ${(info.duration / 1000).toFixed(1)}s${issues.length ? ` | 问题：${issues.join("；")}` : ""}`
    );
  }
}

console.log("\n=== 体检结果 ===");
console.log(`文件 ${summary.files} 个，共 ${summary.totalLines} 行歌词`);
console.log(`解析失败 ${summary.parseFailed}`);
console.log(`含翻译 ${summary.withTranslation}，全行翻译 ${summary.fullyTranslated}`);
console.log(`含和声 ${summary.bgFiles}，含对唱 ${summary.duetFiles}`);
console.log(`可疑 ${summary.suspicious}`);
if (problems.length > 0) {
  console.log("\n前 10 条问题：");
  for (const item of problems.slice(0, 10)) console.log(`  ${item.id}: ${item.reason}`);
}
