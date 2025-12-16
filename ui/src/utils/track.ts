import { EqError, Log } from "@mahiru/ui/utils/dev";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { Time } from "@mahiru/ui/utils/time";
import { API } from "@mahiru/ui/api";

/**
 * 音质等级对应的码率
 */
export const enum TrackQuality {
  l = 128000,
  m = 192000,
  h = 320000,
  sq = 990000,
  hr = 9990000
}

export const Track = new (class {
  private _metaCacheTimeLimit = Time.getCacheTimeLimit(1, "hour");
  private _shouldClearCacheList = new Set<number>();
  private _requestQuality: TrackQuality = TrackQuality.h;

  metaCacheKey(id: number) {
    return `audio_meta_${id}_${this._requestQuality}`;
  }

  sourceCacheKey(id: number) {
    return `audio_source_${id}_${this._requestQuality}`;
  }

  setRequestQuality(level: TrackQuality) {
    this._requestQuality = level;
  }

  async getMeta(id: number, quality?: NeteaseQualityLevels) {
    const cacheKey = this.metaCacheKey(id);
    const cacheResponse = await CacheStore.fetchObject<NeteaseSongUrlResponse>(
      cacheKey,
      this._metaCacheTimeLimit
    );
    if (cacheResponse) {
      return cacheResponse?.data || null;
    }
    return API.Track.getMP3(id, quality)
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

  async loadAudio(track: NeteaseTrack, signal: AbortSignal) {
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

  getTrackSourceQuality<T extends TrackQuality | undefined>(
    track: NeteaseTrack,
    preference: T
  ): TrackSourceQualityReturn<T> {
    const availableQualities: (NeteaseQualityLevels & { level: TrackQuality })[] = [];
    // 收集可用的音质等级,从低到高
    if (track.l)
      availableQualities.push({
        ...track.l,
        level: TrackQuality.l
      });
    if (track.m)
      availableQualities.push({
        ...track.m,
        level: TrackQuality.m
      });
    if (track.h)
      availableQualities.push({
        ...track.h,
        level: TrackQuality.h
      });
    if (track.sq)
      availableQualities.push({
        ...track.sq,
        level: TrackQuality.sq
      });
    if (track.hr)
      availableQualities.push({
        ...track.hr,
        level: TrackQuality.hr
      });
    // 如果没有指定偏好质量，则返回所有可用质量，并按码率从高到低排序
    availableQualities.sort((b, a) => (a.br || 0) - (b.br || 0));
    if (preference === undefined) {
      return availableQualities as TrackSourceQualityReturn<T>;
    } else {
      // 如果指定了偏好质量，先尝试返回该质量等级
      const alreadyExits = availableQualities.find((available) => available.level === preference);
      if (alreadyExits) return alreadyExits as TrackSourceQualityReturn<T>;
      // 如果偏好质量是Hi-Res，则直接返回最高质量
      if (preference === TrackQuality.hr) {
        return availableQualities[0] as TrackSourceQualityReturn<T>;
      }
      // 否则返回最接近偏好质量的音质等级
      let selectedQuality: Undefinable<NeteaseQualityLevels> = availableQualities[0];
      if (selectedQuality) {
        let minDiff = Math.abs((selectedQuality.br || 0) - preference);
        for (const quality of availableQualities) {
          const diff = Math.abs((quality.br || 0) - preference);
          if (diff < minDiff) {
            minDiff = diff;
            selectedQuality = quality;
          }
        }
      }
      return selectedQuality as TrackSourceQualityReturn<T>;
    }
  }

  mapTrackQualityToText(level: TrackQuality) {
    switch (level) {
      case TrackQuality.l:
        return "L";
      case TrackQuality.m:
        return "M";
      case TrackQuality.h:
        return "HD";
      case TrackQuality.sq:
        return "SQ";
      case TrackQuality.hr:
        return "Hi-Res";
    }
  }

  parseTrackBitmark(track: NeteaseTrack, flag: TrackBitmark) {
    const mark = track?.mark;
    if (typeof mark !== "number") return false;
    return (mark & flag) === flag;
  }
})();

type TrackSourceQualityReturn<T extends TrackQuality | undefined> = T extends undefined
  ? (NeteaseQualityLevels & { level: TrackQuality })[]
  : Undefinable<NeteaseQualityLevels & { level: TrackQuality }>;

export enum TrackBitmark {
  Stereo = 8192,
  PureMusic = 131072,
  DolbyAtmos = 262144,
  Explicit = 1048576,
  HiRes = 17179869184
}
