import { Log } from "@/common/lib/log";
import { RendererIdle } from "@/common/lib/idle";

import { TTMLDatabase } from "./ttml-db";
import { TTMLExtraDatabase } from "./ttml-extra-db";

export class AppleMusicLyric {
  private static readonly TTML_BASE_URL =
    "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics";
  /**
   * 自建补充库：本仓库 `ttml` 分支下的 `ttml/ncm-lyrics`，
   * 结构与 amll-ttml-db 一致（同样按网易云 ID 命名），用于补齐前者缺失的曲目。
   */
  private static readonly EXTRA_TTML_BASE_URL =
    "https://raw.githubusercontent.com/Ma-hiru/AiraMusic/refs/heads/ttml/ttml/ncm-lyrics";
  /** 单曲 TTML 的请求预算：歌词在首屏路径上，超时就回退 YRC / QRC */
  private static readonly TTML_TIMEOUT = 2_000;
  /** 补充库是第二顺位，预算更紧，避免拖慢回退 */
  private static readonly EXTRA_TTML_TIMEOUT = 1_500;
  /** 确认没有 TTML 的曲目上限，超出后按先进先出淘汰 */
  private static readonly TTML_MISSING_LIMIT = 512;
  /** 已确认没有 TTML 的曲目，避免同一首歌反复打出 404 */
  private static readonly ttmlMissing = new Set<number>();
  /** 已确认补充库里也没有的曲目 */
  private static readonly extraTtmlMissing = new Set<number>();

  static {
    RendererIdle.normal(() => this.loadIdx(), 1_000, 10_000);
  }

  static loadIdx() {
    return TTMLDatabase.load();
  }

  /** 加载自建补充库的索引（实验性开关打开后才有意义） */
  static loadExtraIdx() {
    return TTMLExtraDatabase.load();
  }

  static getTTML(id: number, signal?: AbortSignal): Promise<null | string> {
    signal?.throwIfAborted();
    if (this.ttmlMissing.has(id)) return Promise.resolve(null);
    if (TTMLDatabase.has(id) === false) return Promise.resolve(null);

    void this.loadIdx();

    const timeout = new AbortController();
    const timer = setTimeout(() => {
      Log.debug("api/lyric.ts:getTTM", "get ttml timeout", id);
      timeout.abort();
    }, this.TTML_TIMEOUT);
    signal?.addEventListener("abort", () => timeout.abort(), { once: true });

    return fetch(`${this.TTML_BASE_URL}/${id}.ttml`, {
      method: "GET",
      signal: timeout.signal
    })
      .then((res) => {
        if (res.status === 404) {
          this.markTTMLMissing(id);
          return null;
        }
        return res.ok ? res.text() : null;
      })
      .catch((err) => {
        signal?.throwIfAborted();
        Log.debug("api/lyric.ts:getTTM", "get ttml failed", err);
        return null;
      })
      .finally(() => {
        clearTimeout(timer);
      });
  }

  /**
   * 从自建补充库取 TTML（实验性）。
   *
   * 只在 `getTTML` 返回 null 之后调用，作为 amll-ttml-db 缺歌时的替补，
   * 调用方需自行根据设置开关决定是否使用。
   */
  static getTTMLByLocal(id: number, signal?: AbortSignal): Promise<null | string> {
    signal?.throwIfAborted();
    if (this.extraTtmlMissing.has(id)) return Promise.resolve(null);
    if (TTMLExtraDatabase.has(id) === false) return Promise.resolve(null);

    void this.loadExtraIdx();

    const timeout = new AbortController();
    const timer = setTimeout(() => {
      Log.debug("apple-music-lyric:getTTMLByLocal", "get extra ttml timeout", id);
      timeout.abort();
    }, this.EXTRA_TTML_TIMEOUT);
    signal?.addEventListener("abort", () => timeout.abort(), { once: true });

    return fetch(`${this.EXTRA_TTML_BASE_URL}/${id}.ttml`, {
      method: "GET",
      signal: timeout.signal
    })
      .then((res) => {
        if (res.status === 404) {
          this.markExtraTTMLMissing(id);
          return null;
        }
        return res.ok ? res.text() : null;
      })
      .catch((err) => {
        signal?.throwIfAborted();
        Log.debug("apple-music-lyric:getTTMLByLocal", "get extra ttml failed", err);
        return null;
      })
      .finally(() => {
        clearTimeout(timer);
      });
  }

  static hasLocalTTML(id: number): boolean {
    if (this.extraTtmlMissing.has(id)) return false;
    return TTMLExtraDatabase.has(id) ?? false;
  }

  private static markExtraTTMLMissing(id: number) {
    if (this.extraTtmlMissing.size >= this.TTML_MISSING_LIMIT) {
      const oldest = this.extraTtmlMissing.values().next().value;
      if (oldest !== undefined) this.extraTtmlMissing.delete(oldest);
    }
    this.extraTtmlMissing.add(id);
  }

  private static markTTMLMissing(id: number) {
    if (this.ttmlMissing.size >= this.TTML_MISSING_LIMIT) {
      const oldest = this.ttmlMissing.values().next().value;
      if (oldest !== undefined) this.ttmlMissing.delete(oldest);
    }
    this.ttmlMissing.add(id);
  }
}
