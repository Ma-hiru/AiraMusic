/**
 * 从歌词文件本身重建 index.jsonl。
 *
 * 每个 TTML 里都写了 `amll:meta`，所以即使索引丢失（进程中断、手工删改）也能复原。
 *
 *   node scripts/ttml/rebuild-index.mjs
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const LYRICS_DIR = resolve(HERE, "../../ttml/ncm-lyrics");

const metaPattern = /<amll:meta\s+key="([^"]+)"\s+value="([^"]*)"\s*\/>/g;
const AUTHOR_GITHUB = "149807805";
const AUTHOR_LOGIN = "Ma-hiru";

// 已存在的索引里记着翻译来源（qq / netease / apple），重建时保留
const previous = new Map();
try {
  const raw = await readFile(join(LYRICS_DIR, "index.jsonl"), "utf8");
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const translation = entry.metadata?.find(([key]) => key === "translation")?.[1]?.[0];
      if (entry?.id && translation && !["yes", "none"].includes(translation)) {
        previous.set(String(entry.id), translation);
      }
    } catch {
      /* 坏行跳过 */
    }
  }
} catch {
  /* 首次运行没有索引 */
}

const files = (await readdir(LYRICS_DIR)).filter((file) => file.endsWith(".ttml")).sort();
const entries = [];

for (const file of files) {
  const id = file.replace(/\.ttml$/, "");
  const xml = await readFile(join(LYRICS_DIR, file), "utf8");

  const meta = {};
  for (const match of xml.matchAll(metaPattern)) meta[match[1]] = match[2];

  const lineCount = (xml.match(/<p\b/g) ?? []).length;
  const hasTranslation = xml.includes('ttm:role="x-translation"');

  entries.push({
    id,
    metadata: [
      ["album", [meta.album ?? ""]],
      ["artists", [meta.artists ?? ""]],
      ["musicName", [meta.musicName ?? ""]],
      ["ncmMusicId", [meta.ncmMusicId ?? id]],
      ["appleMusicId", [meta.appleMusicId ?? ""]],
      ["ttmlAuthorGithub", [meta.ttmlAuthorGithub ?? AUTHOR_GITHUB]],
      ["ttmlAuthorGithubLogin", [meta.ttmlAuthorGithubLogin ?? AUTHOR_LOGIN]],
      ["lineCount", [String(lineCount)]],
      [
        "translation",
        [hasTranslation ? meta.translationSource || previous.get(id) || "yes" : "none"]
      ]
    ]
  });
}

await writeFile(
  join(LYRICS_DIR, "index.jsonl"),
  entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : ""),
  "utf8"
);

console.log(`已重建 ${entries.length} 条索引`);
