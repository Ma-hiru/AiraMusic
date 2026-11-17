import { Log } from "@/common/lib/log";
import { RendererIdle } from "@/common/lib/idle";

import { TTMLDatabase } from "./ttml-db";

export class AppleMusicLyric {
  private static readonly TTML_BASE_URL =
    "https://raw.githubusercontent.com/amll-dev/amll-ttml-db/refs/heads/main/ncm-lyrics";
  /** 单曲 TTML 的请求预算：歌词在首屏路径上，超时就回退 YRC / QRC */
  private static readonly TTML_TIMEOUT = 2_000;
  /** 确认没有 TTML 的曲目上限，超出后按先进先出淘汰 */
  private static readonly TTML_MISSING_LIMIT = 512;
  /** 已确认没有 TTML 的曲目，避免同一首歌反复打出 404 */
  private static readonly ttmlMissing = new Set<number>();

  static {
    RendererIdle.normal(() => this.loadIdx(), 1_000, 10_000);
  }

  static loadIdx() {
    return TTMLDatabase.load();
  }

  static getTTM(id: number, signal?: AbortSignal): Promise<null | string> {
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

  private static markTTMLMissing(id: number) {
    if (this.ttmlMissing.size >= this.TTML_MISSING_LIMIT) {
      const oldest = this.ttmlMissing.values().next().value;
      if (oldest !== undefined) this.ttmlMissing.delete(oldest);
    }
    this.ttmlMissing.add(id);
  }
}
