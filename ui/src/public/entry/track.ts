import pLimit from "p-limit";
import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";
import { TrackQuality } from "@mahiru/ui/public/enum";
import { Time } from "@mahiru/ui/public/entry/time";
import { API } from "@mahiru/ui/public/api";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";
import { Net } from "@mahiru/ui/public/entry/net";

@AddCacheStore
@AddLocalStore
class NeteaseTrackClass {
  private _metaCacheTimeLimit = Time.getCacheTimeLimit(1, "hour");
  private _shouldClearCacheList = new Set<number>();
  private _requestQuality: TrackQuality = TrackQuality.h;

  /// 音频加载器，负责获取音频Meta和音频源（包含缓存处理）

  /** 计算Meta缓存key */
  metaCacheKey(id: number) {
    return `audio_meta_${id}_${this._requestQuality}`;
  }

  /** 计算音频Source缓存Key */
  sourceCacheKey(id: number) {
    return `audio_source_${id}_${this._requestQuality}`;
  }

  /** Set请求首选音质 */
  setRequestQuality(level: TrackQuality) {
    this._requestQuality = level;
  }

  /** 获取Meta，包含缓存源 */
  private async getMeta(id: number, quality?: NeteaseQualityLevels) {
    const cacheKey = this.metaCacheKey(id);
    const cacheResponse = await this.cacheStore.object.fetch<NeteaseSongUrlResponse>(
      cacheKey,
      this._metaCacheTimeLimit
    );
    if (cacheResponse) {
      return cacheResponse?.data || null;
    }
    return API.Track.getMP3(id, quality)
      .then((res) => {
        if (res) void this.cacheStore.object.store(cacheKey, res);
        return res?.data || null;
      })
      .catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            label: "ui/utils/audio.ts",
            message: "get audio meta failed"
          })
        );
        return null;
      });
  }

  /** 获取缓存音频源地址 */
  private async getCacheSource(id: number) {
    const cacheKey = this.sourceCacheKey(id);
    const check = await this.cacheStore.check.one(cacheKey);
    return check.ok ? check.index.file : null;
  }

  /** 设置缓存音频源 */
  private async setCacheSource(id: number, url: string, signal?: AbortSignal) {
    const cacheKey = this.sourceCacheKey(id);
    if (signal && signal.aborted) return;
    let count = 0;
    const store = () => {
      if (Net.getStatus().score < 0.7 || count >= 3) {
        Log.debug("Storing audio source to cache", url, cacheKey);
        void this.cacheStore.store.one(url, cacheKey);
      } else {
        count++;
        requestIdleCallback(store, { timeout: 5000 });
      }
    };
    window.setTimeout(store, 10000);
  }

  /** 删除缓存 */
  public removeCache(id: number) {
    this._shouldClearCacheList.add(id);
    const metaKey = this.metaCacheKey(id);
    const sourceKey = this.sourceCacheKey(id);
    void this.cacheStore.remove.one(metaKey);
    void this.cacheStore.remove.one(sourceKey);
  }

  /** 加载Track，包含Meta和Source */
  public async loadAudio(track: NeteaseTrack, signal: AbortSignal) {
    const quality = this.getTrackSourceQuality(track, this._requestQuality);
    const meta = await this.getMeta(track.id, quality);
    const cacheSource = await this.getCacheSource(track.id);
    if (!cacheSource && meta?.[0]?.url) {
      void this.setCacheSource(track.id, meta?.[0]?.url, signal);
    }
    return {
      meta,
      cacheSource,
      quality
    };
  }

  /** 标记缓存无效 */
  isMarkedInvalidCache(id: number) {
    return this._shouldClearCacheList.has(id);
  }

  /** 移除缓存无效标记 */
  removeMarkedInvalidCache(id: number) {
    this._shouldClearCacheList.delete(id);
  }

  /** 预加载音频源 */
  preloadTrack(nextTrack: NeteaseTrack) {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      const cover = NeteaseImage.setSize(nextTrack.al.picUrl, NeteaseImageSize.raw) || "";
      const audioMeta = await NeteaseTrack.getMeta(nextTrack.id);
      const tasks: { id?: string; url: string }[] = [];
      if (cover) {
        tasks.push({ url: cover });
      }
      if (audioMeta?.[0]?.url) {
        tasks.push({ id: this.sourceCacheKey(nextTrack.id), url: audioMeta?.[0]?.url });
      }
      if (tasks.length > 0 && !controller.signal.aborted) {
        void this.cacheStore.check.orStoreMulti(tasks);
      }
    }, 10000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }

  /// 相关工具方法


}
interface NeteaseTrackClass extends WithCacheStore, WithLocalStore {}

export const NeteaseTrack = new NeteaseTrackClass();
