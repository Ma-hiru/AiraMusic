import pLimit from "p-limit";
import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { AddLocalStore, WithLocalStore } from "@mahiru/ui/public/store/local";
import { TrackBitmark, TrackQuality } from "@mahiru/ui/public/enum";
import { Time } from "@mahiru/ui/public/entry/time";
import { API } from "@mahiru/ui/public/api";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";
import { Auth } from "@mahiru/ui/public/entry/auth";
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

  /** 获取歌曲音质信息 */
  getTrackSourceQuality<T extends TrackQuality | undefined>(
    track: NeteaseTrackBase,
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

  /** 音质文本映射 */
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

  /** 解析歌曲Bitmark */
  parseTrackBitmark(track: NeteaseTrackBase, flag: TrackBitmark) {
    const mark = track?.mark;
    if (typeof mark !== "number") return false;
    return (mark & flag) === flag;
  }

  /** 判断NeteaseTrack是否可以播放 */
  isTrackPlayable(track: NeteaseTrack) {
    const result = {
      playable: true,
      reason: ""
    };

    if (
      // 播放权限 > 0
      (typeof track?.privilege?.pl === "number" && track.privilege.pl > 0) ||
      // 云盘歌曲且已登录
      (Auth.isAccountLoggedIn() && track?.privilege?.cs)
    )
      return result;

    const { UserProfile } = this.localSnapshot.User;
    const vipType = UserProfile?.vipType;
    // 0: 免费或无版权 1: VIP 歌曲 4: 购买专辑 8: 非会员可免费播放低音质，会员可播放高音质及下载
    if (track.fee === 1 || track.privilege?.fee === 1) {
      // VIP 歌曲
      if (Auth.isAccountLoggedIn() && vipType === 11) {
        result.playable = true;
      } else {
        result.playable = false;
        result.reason = "VIP专属";
      }
    } else if (track.fee === 4 || track.privilege?.fee === 4) {
      // 付费专辑
      result.playable = false;
      result.reason = "付费专辑";
    } else if (track.noCopyrightRcmd !== null && track.noCopyrightRcmd !== undefined) {
      result.playable = false;
      result.reason = "无版权";
      // st小于0时为灰色歌曲, 使用上传云盘的方法解灰后 st == 0。
    } else if (track.privilege?.st && track.privilege.st < 0 && Auth.isAccountLoggedIn()) {
      result.playable = false;
      result.reason = "已下架";
    }

    return result;
  }

  /** 拓展track状态，包含版权信息 */
  tracksPrivilegeExtends(tracks: NeteaseTrack[], privileges: NeteaseTrackPrivilege[]) {
    return tracks.map((track) => {
      // 合并 privilege 信息
      const privilege = privileges.find((item) => item.id === track.id);
      if (privilege) track.privilege = { ...(track.privilege ?? {}), ...privilege };
      // 注入 playable 状态
      const { playable, reason } = this.isTrackPlayable(track);
      track.playable = playable;
      track.reason = reason;
      return track as NeteaseTrack & { playable: boolean; reason: string };
    });
  }

  /** 根据歌曲id获取歌曲详情，会考虑请求次数和URL大小限制 */
  async requestTrackDetail(
    ids: TrackId[] | number[],
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const limit = pLimit(concurrency);
    const chunks: number[][] = [];

    if (typeof ids[0] === "object") {
      ids = (ids as TrackId[]).map((track) => track.id);
    }

    for (let i = 0; i < ids.length; i += maxPerRequest) {
      chunks.push((ids as number[]).slice(i, i + maxPerRequest));
    }
    const results = await Promise.all(
      chunks.map((chunk) => limit(() => API.Track.getTrackDetail(chunk.join(","))))
    );
    const tracks: NeteaseTrack[] = [];
    const privilege: NeteaseTrackPrivilege[] = [];
    for (const raw of results) {
      tracks.push(...raw.songs);
      privilege.push(...raw.privileges);
    }
    return { tracks, privilege };
  }
}
interface NeteaseTrackClass extends WithCacheStore, WithLocalStore {}

type TrackSourceQualityReturn<T extends TrackQuality | undefined> = T extends undefined
  ? (NeteaseQualityLevels & { level: TrackQuality })[]
  : Undefinable<NeteaseQualityLevels & { level: TrackQuality }>;

export const NeteaseTrack = new NeteaseTrackClass();
