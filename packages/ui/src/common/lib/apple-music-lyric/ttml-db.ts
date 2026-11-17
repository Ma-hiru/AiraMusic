import { z } from "zod";
import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererFormat } from "@/common/lib/format";

/**
 * amll-ttml-db 的元数据约定（取自 `ncm-lyrics/index.jsonl` 实际数据）：
 *
 * - 字段以 `[字段名, 值数组]` 二元组表示，顺序与数量都不固定，绝不能按数组下标取字段。
 * - 值恒为字符串数组：单值字段只有一项，`artists` / `ncmMusicId` 等多值字段会有多项。
 * - 顶层 `id` 即 `ncm-lyrics/<id>.ttml` 的文件名，且总能与自身的 `ncmMusicId` 对应上。
 */
export const TTMLMetadataFieldSchema = z.tuple([
  z.string().describe("字段名，例如 artists、ncmMusicId、appleMusicId"),
  z.array(z.string()).describe("字段取值，多值字段表示多歌手 / 多平台 ID")
]);
export type TTMLMetadataField = z.infer<typeof TTMLMetadataFieldSchema>;

/** `ncm-lyrics/index.jsonl` 的单行结构，一行对应一个 TTML 文件 */
export const TTMLIndexEntrySchema = z.object({
  id: z.string().regex(/^\d+$/).describe("网易云歌曲 ID，等同于 ncm-lyrics/<id>.ttml 的文件名"),
  metadata: z.array(TTMLMetadataFieldSchema).describe("无序的 [字段名, 值数组] 列表"),
  rawLyricFile: z.string().optional().describe("原始歌词文件名（位于 raw-lyrics/），少数条目缺失")
});
export type TTMLIndexEntry = z.infer<typeof TTMLIndexEntrySchema>;

const INDEX_URL =
  "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics/index.jsonl";

/**
 * TTML 索引缓存
 */
export class TTMLDatabase {
  private static readonly cache_key = "ttml_index";
  /** 索引缓存有效期：一天内直接复用，避免每次启动都重拉近 500 KB */
  private static readonly cache_ttl = RendererFormat.timeLimit(1, "d");
  private static ids: Nullable<ReadonlySet<number>> = null;
  /** 索引可信任到的时刻；0 表示只有过期缓存可用，下次 load 需要刷新 */
  private static expiresAt = 0;
  private static loading: Nullable<Promise<void>> = null;
  private static retryAt = 0;

  static {
    void this.loadCache();
  }

  static async loadCache() {
    const cached = await RendererCache.service.object.getOne<number[]>(
      this.cache_key,
      this.cache_ttl
    );
    if (this.ids || !cached?.length) return;
    this.ids = new Set(cached);
    this.expiresAt = Date.now() + this.cache_ttl;
    Log.info("api/ttml-db", "load ttml index from cache for init", cached.length);
  }

  /** `undefined` 表示索引尚未就绪，`true` / `false` 为确定结论 */
  static has(id: number): Optional<boolean> {
    return this.ids?.has(id);
  }

  static load(): Promise<void> {
    if (this.ids && Date.now() < this.expiresAt) return Promise.resolve();
    if (this.loading) return this.loading;
    if (Date.now() < this.retryAt) return Promise.resolve();

    Log.debug("api/ttml-db", "load ttml index");
    this.loading = fetch(INDEX_URL, { method: "GET" })
      .then((response) => {
        if (!response.ok) throw new Error(`ttml index http ${response.status}`);
        return response.text();
      })
      .then((jsonl) => {
        const ids = this.collectTTMLIDs(this.parseTTMLIndex(jsonl));
        if (ids.size === 0) throw new Error("ttml index is empty");
        Log.debug("api/ttml-db", `ttml index loaded: ${ids.size} ids`);
        this.expiresAt = Date.now() + this.cache_ttl;
        return (this.ids = ids);
      })
      .then((ids) => {
        RendererCache.service.object
          .setOne({
            id: this.cache_key,
            data: Array.from(ids)
          })
          .then(() => {
            Log.debug("api/ttml-db", `ttml index cached: ${ids.size} ids`);
          });
      })
      .catch((err) => {
        // 网络失败后冷却一分钟再试，避免每首歌都重新拉一遍近 500 KB 的索引
        this.retryAt = Date.now() + 60_000;
        Log.debug("api/ttml-db", "load ttml index failed", err);
      })
      .finally(() => {
        this.loading = null;
      });

    return this.loading;
  }

  static reset() {
    this.ids = null;
    this.expiresAt = 0;
    this.loading = null;
    this.retryAt = 0;
  }

  /** 逐行解析 jsonl；远端结构会演进，单行校验失败只丢该行，不影响其余数据 */
  static parseTTMLIndex(jsonl: string): TTMLIndexEntry[] {
    const entries: TTMLIndexEntry[] = [];
    for (const line of jsonl.split("\n")) {
      const text = line.trim();
      if (!text) continue;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        continue;
      }
      const parsed = TTMLIndexEntrySchema.safeParse(raw);
      if (parsed.success) entries.push(parsed.data);
    }
    return entries;
  }

  /** 索引中出现过的歌曲 ID，即当前确实存在 `<id>.ttml` 的曲目集合 */
  static collectTTMLIDs(entries: TTMLIndexEntry[]): ReadonlySet<number> {
    const ids = new Set<number>();
    for (const entry of entries) ids.add(Number(entry.id));
    return ids;
  }
}
