/**
 * 降级修正：逐字罗马音覆盖率过低的文件，改成行级罗马音。
 *
 * 逐字罗马音依赖"Apple 词元 ↔ QQ 音节"的时间对齐，遇到对唱、切分差异大的歌
 * 会出现大片空缺甚至错位，这种情况行级罗马音更稳妥。
 *
 *   node scripts/ttml/fix-roman.mjs --threshold 0.6
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { JSDOM } from "jsdom";

globalThis.DOMParser ??= new JSDOM().window.DOMParser;
const { parseTTML } = await import("@applemusic-like-lyrics/lyric");

const { alignRomanizationLineLevel, escapeXml, parseAppleTTML } =
  await import("./lib/amll-ttml.mjs");
const { resolveQQTranslation } = await import("./lib/qq.mjs");

const HERE = dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = resolve(HERE, "../../ttml/ncm-lyrics");

const args = process.argv.slice(2);
const thresholdIndex = args.indexOf("--threshold");
const threshold = thresholdIndex > -1 ? Number(args[thresholdIndex + 1]) : 0.6;

const META_RE = /<amll:meta\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/g;
const readMeta = (xml) => {
  const meta = {};
  for (const matched of xml.matchAll(META_RE)) meta[matched[1]] = matched[2];
  return meta;
};

const files = (await readdir(LYRICS_DIR)).filter((file) => file.endsWith(".ttml"));
const stats = { checked: 0, downgraded: 0, kept: 0, failed: 0 };

for (const file of files) {
  const path = join(LYRICS_DIR, file);
  const xml = await readFile(path, "utf8");
  if (!xml.includes("<transliterations>")) continue;
  stats.checked++;

  const parsed = parseTTML(xml);
  const words = parsed.lines.flatMap((line) => line.words);
  const coverage = words.length ? words.filter((word) => word.romanWord).length / words.length : 1;

  if (coverage >= threshold) {
    stats.kept++;
    continue;
  }

  const meta = readMeta(xml);
  try {
    const qq = await resolveQQTranslation({
      name: meta.musicName ?? "",
      artist: meta.artists ?? "",
      album: meta.album ?? ""
    });
    if (!qq?.romanLines?.length) throw new Error("QQ 无罗马音");

    const apple = parseAppleTTML(xml);
    const lineMap = alignRomanizationLineLevel(apple.lines, qq.romanLines, {
      tolerance: 2500,
      includeWordTimed: true
    });
    if (lineMap.size === 0) throw new Error("行级对齐失败");

    const stripped = xml.replace(
      /<iTunesMetadata[^>]*><transliterations>[\s\S]*?<\/transliterations><\/iTunesMetadata>/,
      ""
    );
    const next = stripped.replace(/<p\b([^>]*)>([\s\S]*?)<\/p>/g, (whole, attrs, inner) => {
      const key = /itunes:key="([^"]+)"/.exec(attrs)?.[1];
      const text = key ? lineMap.get(key) : null;
      if (!text || inner.includes('ttm:role="x-roman"')) return whole;
      return `<p${attrs}>${inner}<span ttm:role="x-roman" xml:lang="ja-Latn">${escapeXml(text)}</span></p>`;
    });

    await writeFile(path, next, "utf8");
    stats.downgraded++;
    console.log(
      `↓ ${meta.musicName ?? file}  逐字覆盖 ${(coverage * 100).toFixed(0)}% → 行级 ${lineMap.size} 行`
    );
  } catch (error) {
    stats.failed++;
    console.log(`× ${meta.musicName ?? file}：${error?.message ?? error}`);
  }
}

console.log(
  `\n检查 ${stats.checked} 个逐字罗马音文件：保留 ${stats.kept}，降级 ${stats.downgraded}，失败 ${stats.failed}`
);
