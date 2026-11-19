import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { RendererFormat } from "@/common/lib/format";

import { TTMLDatabase } from "./ttml-db";

const INDEX_URL =
  "https://raw.githubusercontent.com/Ma-hiru/AiraMusic/refs/heads/ttml/ttml/ncm-lyrics/index.jsonl";

/**
 * 自建补充歌词库的索引（实验性）。
 *
 * 结构与 amll-ttml-db 完全一致：同样按网易云 ID 命名，同样有一份 `index.jsonl`，
 * 所以解析逻辑直接复用 {@link TTMLDatabase.parseTTMLIndex}。
 *
 * 与主库的区别：
 * - 内容由本地抓取脚本生成，含翻译与逐字罗马音，但随时可能变更；
 * - 只在设置里开启 `preference.useExtraTTML` 后才会被 `AppleMusicLyric` 使用；
 * - 索引缓存与主库分开，避免互相覆盖。
 */
export class TTMLExtraDatabase {
  private static readonly cache_key = "ttml_extra_index";
  /** 索引缓存有效期：一天内直接复用 */
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
    Log.info("api/ttml-extra-db", "load extra ttml index from cache for init", cached.length);
  }

  /** `undefined` 表示索引尚未就绪，`true` / `false` 为确定结论 */
  static has(id: number): Optional<boolean> {
    return this.ids?.has(id);
  }

  static load(): Promise<void> {
    if (this.ids && Date.now() < this.expiresAt) return Promise.resolve();
    if (this.loading) return this.loading;
    if (Date.now() < this.retryAt) return Promise.resolve();

    Log.debug("api/ttml-extra-db", "load extra ttml index");
    this.loading = fetch(INDEX_URL, { method: "GET" })
      .then((response) => {
        if (!response.ok) throw new Error(`extra ttml index http ${response.status}`);
        return response.text();
      })
      .then((jsonl) => {
        const ids = TTMLDatabase.collectTTMLIDs(TTMLDatabase.parseTTMLIndex(jsonl));
        if (ids.size === 0) throw new Error("extra ttml index is empty");
        Log.debug("api/ttml-extra-db", `extra ttml index loaded: ${ids.size} ids`);
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
            Log.debug("api/ttml-extra-db", `extra ttml index cached: ${ids.size} ids`);
          });
      })
      .catch((err) => {
        // 拉不到就冷却一分钟再试，期间退化为逐首 404 试探
        this.retryAt = Date.now() + 60_000;
        Log.debug("api/ttml-extra-db", "load extra ttml index failed", err);
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
}
