/**
 * 命令行批量抓取。
 *
 *   node scripts/ttml/fetch-ttml.mjs --source recent --limit 20
 *   node scripts/ttml/fetch-ttml.mjs --source library --limit 100 --force
 *   node scripts/ttml/fetch-ttml.mjs --from-json songs.json --limit 30
 *
 * songs.json 形如 [{"name":"晴天","artist":"周杰伦"}]，用于把外部歌单（例如红心列表）映射到 Apple 曲库。
 */
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AppleMusicClient,
  AuthStore,
  fetchDeveloperToken,
  decodeTokenExpiry
} from "./lib/apple.mjs";
import { collect, ensureOutDir } from "./lib/collect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const OUT_DIR = join(REPO_ROOT, "ttml");
const AUTH_FILE = join(HERE, ".auth.json");

function parseArgs(argv) {
  const args = { source: "recent", limit: 20, force: false, concurrency: 3 };
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (key === "force") args.force = true;
    else if (key === "list") args.list = true;
    else if (next && !next.startsWith("--")) {
      args[key] = key === "limit" || key === "concurrency" ? Number(next) : next;
      index++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const store = new AuthStore(AUTH_FILE);
  const auth = await store.load();
  if (!auth?.mediaUserToken) {
    console.error("尚未授权。请先运行 `node scripts/ttml/server.mjs` 并在网页中完成授权。");
    process.exitCode = 1;
    return;
  }

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

  let songs = [];
  if (args["from-json"]) {
    const list = JSON.parse(await readFile(resolve(args["from-json"]), "utf8"));
    songs = list.slice(0, args.limit).map((item) => ({
      id: item.id ?? null,
      name: item.name ?? item.title,
      artist: item.artist ?? item.artistName ?? "",
      album: item.album ?? "",
      source: "import"
    }));
  } else if (args.list) {
    const [recent, library, heavy] = await Promise.all([
      client.listRecentPlayed({ limit: args.limit }).catch(() => []),
      client.listLibrarySongs({ limit: args.limit, maxItems: args.limit }).catch(() => []),
      client.listHeavyRotation({ limit: 20 }).catch(() => [])
    ]);
    console.log(`最近播放 ${recent.length} / 资料库 ${library.length} / 重度聆听 ${heavy.length}`);
    return;
  } else if (args.source === "library") {
    songs = await client.listLibrarySongs({ limit: args.limit, maxItems: args.limit });
  } else if (args.source === "heavy") {
    songs = await client.listHeavyRotation({ limit: args.limit });
  } else {
    songs = await client.listRecentPlayed({ limit: args.limit });
  }

  const uniq = songs.filter(
    (song, index, all) => all.findIndex((item) => item.id === song.id) === index
  );
  if (uniq.length === 0) {
    console.log("没有可抓取的曲目。");
    return;
  }

  await ensureOutDir(OUT_DIR);
  console.log(`共 ${uniq.length} 首，输出到 ${OUT_DIR}\n`);

  const stats = await collect({
    client,
    songs: uniq,
    rootDir: OUT_DIR,
    concurrency: args.concurrency,
    force: args.force,
    onProgress: (event) => {
      if (event.type !== "item") return;
      const mark =
        { saved: "✓", skipped: "=", missing: "-", unmapped: "?", failed: "×" }[event.status] ?? "?";
      const song = event.song ?? {};
      const extra = event.entry
        ? `  [${event.entry.lines}行 / 译${event.entry.translations} / ${event.entry.translationSource}]`
        : "";
      console.log(
        `${mark} ${song.name} — ${song.artist}${extra}${event.reason ? ` (${event.reason})` : ""}`
      );
    }
  });

  console.log(
    `\n完成：保存 ${stats.saved}，跳过 ${stats.skipped}，无歌词 ${stats.missing}，未匹配 ${stats.unmapped}，失败 ${stats.failed}，带翻译 ${stats.translated}`
  );
}

main().catch((error) => {
  console.error("执行失败：", error?.message ?? error);
  process.exitCode = 1;
});
