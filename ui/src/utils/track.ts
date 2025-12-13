import { getMP3 } from "@mahiru/ui/api/track";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Time } from "@mahiru/ui/utils/time";

export const Track = new (class {
  private _metaCacheTimeLimit = Time.getCacheTimeLimit(1, "hour");
  private _shouldClearCacheList = new Set<number>();

  metaCacheKey(id: number) {
    return `audio_meta_${id}`;
  }

  sourceCacheKey(id: number) {
    return `audio_source_${id}`;
  }

  async getMeta(id: number) {
    const cacheKey = this.metaCacheKey(id);
    const cacheResponse = await CacheStore.fetchObject<NeteaseSongUrlResponse>(
      cacheKey,
      this._metaCacheTimeLimit
    );
    if (cacheResponse) {
      return cacheResponse?.data || null;
    }
    return getMP3(id)
      .then((res) => {
        if (res) void CacheStore.storeObject(cacheKey, res);
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

  async getCacheSource(id: number) {
    const cacheKey = this.sourceCacheKey(id);
    const check = await CacheStore.check(cacheKey);
    return check.ok ? check.index.file : null;
  }

  async setCacheSource(id: number, url: string, signal?: AbortSignal) {
    const cacheKey = this.sourceCacheKey(id);
    if (signal && signal.aborted) return;
    void CacheStore.storeAsync(url, cacheKey);
  }

  removeCache(id: number) {
    this._shouldClearCacheList.add(id);
    const metaKey = this.metaCacheKey(id);
    const sourceKey = this.sourceCacheKey(id);
    void CacheStore.remove(metaKey);
    void CacheStore.remove(sourceKey);
  }

  markedInvalidCache(id: number) {
    return this._shouldClearCacheList.has(id);
  }

  removeMarkedInvalidCache(id: number) {
    this._shouldClearCacheList.delete(id);
  }

  async loadAudio(id: number, signal: AbortSignal) {
    const meta = await this.getMeta(id);
    const cacheSource = await this.getCacheSource(id);
    if (!cacheSource && meta?.[0]?.url) {
      void this.setCacheSource(id, meta?.[0]?.url, signal);
    }
    return {
      meta,
      cacheSource
    };
  }

  preloadTrack(nextTrack: NeteaseTrack) {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      const cover = Filter.NeteaseImageSize(nextTrack.al.picUrl, ImageSize.raw) || "";
      const audioMeta = await Track.getMeta(nextTrack.id);
      const tasks: { id?: string; url: string }[] = [];
      if (cover) {
        tasks.push({ url: cover });
      }
      if (audioMeta?.[0]?.url) {
        tasks.push({ id: this.sourceCacheKey(nextTrack.id), url: audioMeta?.[0]?.url });
      }
      if (tasks.length > 0 && !controller.signal.aborted) {
        void CacheStore.checkOrStoreAsyncMutil(tasks);
      }
    }, 10000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }

  // TODO: 实现下载功能
  download(id: number) {}
})();
