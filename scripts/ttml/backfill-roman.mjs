/**
 * 给已有的日文歌词补逐字罗马音。
 *
 *   node scripts/ttml/backfill-roman.mjs --limit 20
 *   node scripts/ttml/backfill-roman.mjs --all
 *
 * 只走 QQ 音乐，不碰 Apple：从文件里读出词元时间轴，把 QQ 的音节级罗马音
 * 按时间对齐后塞进 `<iTunesMetadata><transliterations>`，原文件其余内容原样保留。
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  alignRomanization,
  alignRomanizationLineLevel,
  buildTransliterationsXML,
  escapeXml,
  parseAppleTTML
} from "./lib/amll-ttml.mjs";
import { resolveQQTranslation } from "./lib/qq.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = resolve(HERE, "../../ttml/ncm-lyrics");

const args = process.argv.slice(2);
const all = args.includes("--all");
const limitIndex = args.indexOf("--limit");
const limit = limitIndex > -1 ? Number(args[limitIndex + 1]) : 20;
const concurrencyIndex = args.indexOf("--concurrency");
const concurrency = concurrencyIndex > -1 ? Number(args[concurrencyIndex + 1]) : 3;

const META_RE = /<amll:meta\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/g;

function readMeta(xml) {
  const meta = {};
  for (const matched of xml.matchAll(META_RE)) meta[matched[1]] = matched[2];
  return meta;
}

const files = (await readdir(LYRICS_DIR)).filter((file) => file.endsWith(".ttml")).sort();
const queue = [];

for (const file of files) {
  const xml = await readFile(join(LYRICS_DIR, file), "utf8");
  if (!/xml:lang="ja/.test(xml)) continue;
  if (xml.includes("<transliterations>")) continue;
  queue.push({ file, meta: readMeta(xml) });
}

const targets = all ? queue : queue.slice(0, limit);
console.log(`日文歌词待补 ${queue.length} 个，本次处理 ${targets.length}\n`);

const stats = { saved: 0, noRoma: 0, failed: 0, words: 0, lines: 0, wordLevel: 0, lineLevel: 0 };
let processed = 0;

async function worker() {
  while (targets.length > 0) {
    const item = targets.shift();
    const path = join(LYRICS_DIR, item.file);
    try {
      const xml = await readFile(path, "utf8");
      const parsed = parseAppleTTML(xml);

      const qq = await resolveQQTranslation({
        name: item.meta.musicName ?? "",
        artist: item.meta.artists ?? "",
        album: item.meta.album ?? ""
      });

      if (!qq?.romanLines?.length) {
        stats.noRoma++;
        processed++;
        console.log(`- ${item.meta.musicName ?? item.file}（QQ 无罗马音）`);
        continue;
      }

      const transliterations = alignRomanization(parsed.lines, qq.romanLines);
      let next = null;
      let lines = 0;

      if (transliterations.size > 0) {
        // 逐字型：写 sidecar，解析器回填 romanWord
        const fragment = buildTransliterationsXML(parsed, transliterations);
        if (fragment) {
          next = xml.replace("</metadata>", `${fragment}</metadata>`);
          lines = transliterations.size;
          for (const spans of transliterations.values()) {
            stats.words += spans.filter((span) => span.text).length;
          }
          stats.wordLevel++;
        }
      }

      if (!next) {
        // 逐行型：只能做行级罗马音，写进 <p> 尾部
        const lineMap = alignRomanizationLineLevel(parsed.lines, qq.romanLines);
        if (lineMap.size === 0) {
          stats.noRoma++;
          processed++;
          console.log(`- ${item.meta.musicName ?? item.file}（对齐失败）`);
          continue;
        }
        next = xml.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/g, (whole, attrs, inner) => {
          const key = /itunes:key="([^"]+)"/.exec(attrs)?.[1];
          const text = key ? lineMap.get(key) : null;
          if (!text || inner.includes('ttm:role="x-roman"')) return whole;
          return `<p${attrs}>${inner}<span ttm:role="x-roman" xml:lang="ja-Latn">${escapeXml(text)}</span></p>`;
        });
        lines = lineMap.size;
        stats.lineLevel++;
      }

      await writeFile(path, next, "utf8");
      stats.saved++;
      stats.lines += lines;
      processed++;
      console.log(
        `✓ ${item.meta.musicName ?? item.file}  罗马音 ${lines} 行 / 已处理 ${processed}`
      );
    } catch (error) {
      stats.failed++;
      processed++;
      console.log(`× ${item.meta.musicName ?? item.file}：${error?.message ?? error}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));

console.log(
  `\n完成：补罗马音 ${stats.saved} 个文件（逐字 ${stats.wordLevel} / 逐行 ${stats.lineLevel}），` +
    `覆盖 ${stats.lines} 行 / ${stats.words} 个词元，无罗马音 ${stats.noRoma}，失败 ${stats.failed}`
);
