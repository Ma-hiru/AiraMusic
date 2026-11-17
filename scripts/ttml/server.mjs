/**
 * Apple Music TTML 歌词抓取的本地服务。
 *
 * 用法：node scripts/ttml/server.mjs [--port 8787]
 * 然后浏览器打开 http://127.0.0.1:8787
 */
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AppleMusicClient,
  AuthStore,
  fetchDeveloperToken,
  normalizeMediaUserToken
} from "./lib/apple.mjs";
import { collect, ensureOutDir, lyricsDir, readIndex } from "./lib/collect.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const OUT_DIR = join(REPO_ROOT, "ttml");
const AUTH_FILE = join(HERE, ".auth.json");
const PAGE_FILE = join(HERE, "index.html");

const argPort = (() => {
  const index = process.argv.indexOf("--port");
  return index > -1 ? Number(process.argv[index + 1]) : undefined;
})();
const PORT = Number(argPort || process.env.TTML_PORT || 8787);

const authStore = new AuthStore(AUTH_FILE);
const eventClients = new Set();
const job = { running: false, controller: null, stats: null, source: null };

const SOURCE_LABELS = {
  recent: "最近播放",
  library: "我的资料库",
  heavy: "重度聆听（常听）"
};

/** 每类来源缓存，避免每次刷新页面都重新拉取 */
const sourceCache = new Map();
const SOURCE_TTL = 60_000;

function sendJSON(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 8_000_000) {
        reject(new Error("请求体过大"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        reject(new Error("请求体不是合法 JSON"));
      }
    });
    request.on("error", reject);
  });
}

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const response of eventClients) {
    response.write(payload);
  }
}

async function buildClient() {
  const auth = await authStore.load();
  if (!auth?.mediaUserToken) return null;
  let developerToken = auth.developerToken;
  const expiry = auth.developerTokenExpiry ?? 0;
  if (!developerToken || expiry < Date.now() + 86_400_000) {
    developerToken = await fetchDeveloperToken().catch(() => null);
    if (developerToken) {
      const { decodeTokenExpiry } = await import("./lib/apple.mjs");
      await authStore.save({
        developerToken,
        developerTokenExpiry: decodeTokenExpiry(developerToken)
      });
    }
  }
  if (!developerToken) return null;
  return new AppleMusicClient({
    mediaUserToken: auth.mediaUserToken,
    developerToken,
    storefront: auth.storefront || "cn"
  });
}

async function loadSource(client, source, limit) {
  const cached = sourceCache.get(source);
  if (cached && Date.now() - cached.at < SOURCE_TTL && cached.limit >= limit) {
    return cached.songs.slice(0, limit);
  }
  let songs = [];
  if (source === "recent") songs = await client.listRecentPlayed({ limit });
  else if (source === "library") songs = await client.listLibrarySongs({ limit, maxItems: limit });
  else if (source === "heavy") songs = await client.listHeavyRotation({ limit });
  songs = songs.filter(
    (song, index, all) => song.id && all.findIndex((s) => s.id === song.id) === index
  );
  sourceCache.set(source, { at: Date.now(), limit, songs });
  return songs;
}

async function handleStatus(response) {
  const auth = await authStore.load();
  const index = await readIndex(OUT_DIR);
  sendJSON(response, 200, {
    authorized: Boolean(auth?.mediaUserToken),
    storefront: auth?.storefront ?? null,
    authorizedAt: auth?.savedAt ?? null,
    developerTokenExpiry: auth?.developerTokenExpiry ?? null,
    outputDir: lyricsDir(OUT_DIR),
    collected: index.size,
    job: { running: job.running, stats: job.stats, source: job.source }
  });
}

async function handleAuth(request, response) {
  const body = await readBody(request);
  const mut = normalizeMediaUserToken(body.mediaUserToken);
  if (!mut) return sendJSON(response, 400, { error: "缺少 media-user-token" });

  const developerToken = await fetchDeveloperToken();
  const client = new AppleMusicClient({ mediaUserToken: mut, developerToken });
  const { storefront, language } = await client.verifyAuth();
  const { decodeTokenExpiry } = await import("./lib/apple.mjs");
  await authStore.save({
    mediaUserToken: mut,
    storefront,
    language,
    developerToken,
    developerTokenExpiry: decodeTokenExpiry(developerToken)
  });
  sourceCache.clear();
  sendJSON(response, 200, { ok: true, storefront, language });
}

async function handleSources(response) {
  const client = await buildClient();
  if (!client) return sendJSON(response, 401, { error: "尚未授权" });

  const entries = await Promise.all(
    Object.keys(SOURCE_LABELS).map(async (key) => {
      try {
        const songs = await loadSource(client, key, 100);
        return { key, label: SOURCE_LABELS[key], count: songs.length, songs };
      } catch (error) {
        return {
          key,
          label: SOURCE_LABELS[key],
          count: 0,
          songs: [],
          error: error?.message ?? String(error)
        };
      }
    })
  );
  sendJSON(response, 200, { storefront: client.storefront, sources: entries });
}

async function handleJob(request, response) {
  if (job.running) return sendJSON(response, 409, { error: "已有任务在执行" });
  const body = await readBody(request);
  const source = body.source in SOURCE_LABELS ? body.source : "recent";
  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 500);
  const force = Boolean(body.force);

  const client = await buildClient();
  if (!client) return sendJSON(response, 401, { error: "尚未授权" });

  let songs;
  try {
    songs = await loadSource(client, source, limit);
  } catch (error) {
    return sendJSON(response, 502, { error: error?.message ?? String(error) });
  }
  if (songs.length === 0) return sendJSON(response, 200, { ok: true, total: 0 });

  job.running = true;
  job.stats = null;
  job.source = source;
  job.controller = new AbortController();
  sendJSON(response, 202, { ok: true, total: songs.length });

  void (async () => {
    try {
      await ensureOutDir(OUT_DIR);
      const stats = await collect({
        client,
        songs,
        rootDir: OUT_DIR,
        concurrency: 3,
        force,
        onProgress: broadcast,
        signal: job.controller.signal
      });
      job.stats = stats;
      if (stats.unauthorized) {
        await authStore.clear();
        broadcast({ type: "auth-error", message: "授权已失效，请重新授权" });
      }
    } catch (error) {
      broadcast({ type: "error", message: error?.message ?? String(error) });
    } finally {
      job.running = false;
      job.controller = null;
      sourceCache.clear();
      broadcast({ type: "finished", stats: job.stats });
    }
  })();
}

async function handleSSE(request, response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive"
  });
  response.write(`retry: 2000\n\n`);
  response.write(`data: ${JSON.stringify({ type: "hello" })}\n\n`);
  eventClients.add(response);
  const keepAlive = setInterval(() => response.write(": ping\n\n"), 15000);
  request.on("close", () => {
    clearInterval(keepAlive);
    eventClients.delete(response);
  });
}

async function handlePreview(url, response) {
  const id = url.pathname.split("/").pop();
  if (!/^\d+$/.test(id)) return sendJSON(response, 400, { error: "非法的曲目 ID" });
  try {
    const ttml = await readFile(join(lyricsDir(OUT_DIR), `${id}.ttml`), "utf8");
    sendJSON(response, 200, { id, ttml });
  } catch {
    sendJSON(response, 404, { error: "文件不存在" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  try {
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      const html = await readFile(PAGE_FILE);
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      });
      return response.end(html);
    }
    if (request.method === "GET" && url.pathname === "/api/status")
      return await handleStatus(response);
    if (request.method === "POST" && url.pathname === "/api/auth")
      return await handleAuth(request, response);
    if (request.method === "DELETE" && url.pathname === "/api/auth") {
      await authStore.clear();
      sourceCache.clear();
      return sendJSON(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/sources")
      return await handleSources(response);
    if (request.method === "POST" && url.pathname === "/api/job")
      return await handleJob(request, response);
    if (request.method === "POST" && url.pathname === "/api/import/liked") {
      const body = await readBody(request).catch(() => null);
      const songs = Array.isArray(body) ? body : body?.songs;
      if (!Array.isArray(songs) || songs.length === 0) {
        return sendJSON(response, 400, { error: "缺少 songs 数组" });
      }
      await writeFile(
        join(OUT_DIR, "liked-songs.json"),
        JSON.stringify(
          { importedAt: new Date().toISOString(), count: songs.length, songs },
          null,
          2
        ),
        "utf8"
      );
      return sendJSON(response, 200, { ok: true, count: songs.length });
    }
    if (request.method === "POST" && url.pathname === "/api/job/stop") {
      job.controller?.abort();
      return sendJSON(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/api/events")
      return await handleSSE(request, response);
    if (request.method === "GET" && url.pathname.startsWith("/api/lyrics/"))
      return await handlePreview(url, response);
    if (request.method === "POST" && url.pathname === "/api/open-folder") {
      execFile("open", [lyricsDir(OUT_DIR)], () => {});
      return sendJSON(response, 200, { ok: true });
    }

    sendJSON(response, 404, { error: "Not Found" });
  } catch (error) {
    sendJSON(response, 500, { error: error?.message ?? String(error) });
  }
});

server.listen(PORT, "127.0.0.1", async () => {
  await ensureOutDir(OUT_DIR);
  console.log(`\n  Apple Music TTML 抓取服务已启动`);
  console.log(`  控制台: http://127.0.0.1:${PORT}`);
  console.log(`  输出目录: ${lyricsDir(OUT_DIR)}\n`);
});
