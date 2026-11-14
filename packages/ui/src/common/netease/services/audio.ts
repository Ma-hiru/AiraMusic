import { Log } from "@/common/lib/log";
import { RendererIdle } from "@/common/lib/idle";
import { RendererCache } from "@/common/lib/cache";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPITrack } from "@/common/netease/api";
import { userStoreSnapshot } from "@/common/store/user";
import { TrackQuality, StoreCategory } from "@/common/enum";
import { settingsStoreSnapshot } from "@/common/store/settings";
import {
  NeteaseUser,
  NeteaseTrack,
  NeteaseLocalAudio,
  NeteaseNetworkAudio
} from "@/common/netease/models";
import axios from "axios";
import type { CacheStoreCheckRes, CacheStoreResponse } from "@/types/cache";

export default class _NeteaseAudioSource {
  //region cache
  private static readonly cacheKey = "netease_audio";

  /** 用户 ID */
  private static get userID() {
    return userStoreSnapshot()._user?.userId ?? 0;
  }

  /** 音质偏好 */
  private static get preference() {
    return settingsStoreSnapshot()._settings.trackQuality.quality;
  }

  /** 生成元信息缓存 key */
  private static buildMetaCacheKey(meta: { id: number; quality: TrackQuality }): string {
    return `${this.cacheKey}_meta_${meta.id}_${meta.quality}_${this.userID}`;
  }

  /** 存储元信息缓存 */
  private static storeMetaCache(meta: NeteaseNetworkAudio): Promise<any> {
    Log.debug("_NeteaseAudioSource", "storeMetaCache", this.buildMetaCacheKey(meta));
    return RendererCache.service.object
      .setOne({
        id: this.buildMetaCacheKey(meta),
        data: meta
      })
      .catch((err) => {
        Log.error("_NeteaseAudioSource", "storeMetaCache error", this.buildMetaCacheKey(meta), err);
      });
  }

  /** 获取元信息缓存 */
  private static getMetaCache(meta: {
    id: number;
    quality: TrackQuality;
  }): Promise<Nullable<NeteaseNetworkAudio>> {
    Log.debug("_NeteaseAudioSource", "getMetaCache", this.buildMetaCacheKey(meta));
    return RendererCache.service.object
      .getOne<NeteaseNetworkAudio>(this.buildMetaCacheKey(meta))
      .then(NeteaseLocalAudio.fromObject)
      .catch((err) => {
        Log.error("_NeteaseAudioSource", "getMetaCache error", this.buildMetaCacheKey(meta), err);
        return null;
      });
  }

  /** 生成音频缓存 key */
  private static buildAudioCacheKey(audio: { id: number; quality: TrackQuality }): string {
    return `${this.cacheKey}_${audio.id}_${audio.quality}_${this.userID}`;
  }

  /** 存储音频缓存 */
  private static storeAudioCache(audio: {
    id: number;
    url: string;
    quality: TrackQuality;
  }): Promise<any> {
    Log.debug("_NeteaseAudioSource", "storeAudioCache", this.buildAudioCacheKey(audio));
    return RendererCache.service.save
      .url([
        {
          url: audio.url,
          id: this.buildAudioCacheKey(audio),
          category: StoreCategory.Audio
        }
      ])
      .catch((err) => {
        Log.error(
          "_NeteaseAudioSource",
          "storeAudioCache error",
          this.buildAudioCacheKey(audio),
          err
        );
      });
  }

  /** 获取音频缓存 */
  private static getAudioCache(audio: {
    id: number;
    quality: TrackQuality;
  }): Promise<Nullable<CacheStoreResponse<CacheStoreCheckRes>>> {
    let ok: boolean = false;
    return RendererCache.service.check
      .readOne({ id: this.buildAudioCacheKey(audio) })
      .then((cache) => {
        ok = cache.code === 200 && cache.data.ok;
        return cache;
      })
      .catch(() => null)
      .finally(() => {
        Log.debug(
          "_NeteaseAudioSource",
          `checkAudioCache ${ok ? "ok" : "not ok"}`,
          this.buildAudioCacheKey(audio)
        );
      });
  }

  /** 生成解析缓存 key */
  private static buildResolveCacheKey(id: number, preference?: TrackQuality): string {
    return `${this.cacheKey}_resolve_${id}_${preference ?? this.preference}_${this.userID}`;
  }

  /** 存储解析缓存 */
  private static storeResolveCache(id: number, quality: TrackQuality, preference?: TrackQuality) {
    const key = this.buildResolveCacheKey(id, preference);
    Log.debug("_NeteaseAudioSource", "storeResolveCache", key);
    return RendererCache.service.object
      .setOne<TrackQuality>({
        id: key,
        data: quality
      })
      .catch((err) => {
        Log.error("_NeteaseAudioSource", "storeResolveCache error", key, err);
        return null;
      });
  }

  /** 获取解析缓存 */
  private static getResolveCache(id: number): Promise<Optional<TrackQuality>> {
    const key = this.buildResolveCacheKey(id);
    Log.debug("_NeteaseAudioSource", "getResolveCache", key);
    return RendererCache.service.object.getOne<TrackQuality>(key).catch((err) => {
      Log.error("_NeteaseAudioSource", "getResolveCache error", key, err);
      return null;
    });
  }
  //endregion

  /** 结合vip状态、偏好、实际音质列表，计算应该请求的音质 */
  private static resolveQuality(track: NeteaseTrack) {
    track = NeteaseTrack.fromObject(track);
    const qualities = track.qualities(NeteaseUser.isVIP(userStoreSnapshot()._user));
    return {
      quality: (qualities.find((q) => q.label === this.preference) ?? qualities[0])?.label,
      qualities
    };
  }

  /** 所有 NeteaseNetworkAudio 的唯一来源，音质可能与偏好不同 */
  private static async latestAudio(
    track: NeteaseTrack,
    tries: number
  ): Promise<Nullable<NeteaseNetworkAudio>> {
    if (!Number.isSafeInteger(tries)) tries = 3;
    if (tries <= 0) return null;
    const { quality, qualities } = this.resolveQuality(track);

    let meta;
    try {
      const urlResponse = await NeteaseAPITrack.urlNew(
        track.id,
        RendererFormat.musicLevel(quality ?? TrackQuality.h)
      );
      meta = urlResponse.data[0];
    } catch (e) {
      if (tries <= 1 || !axios.isAxiosError(e)) {
        Log.error("_NeteaseAudioSource", "latestAudio failed", track.id, e);
        return null;
      }
      const delayTime = Math.round(3_500 * 2 ** (3 - tries) * (0.8 + Math.random() * 0.4));
      Log.warn("_NeteaseAudioSource", `latestAudio retry in ${delayTime}ms`, track.id, e);
      await new Promise((resolve) => setTimeout(resolve, delayTime));
      return this.latestAudio(track, tries - 1);
    }

    if (!meta || !meta.url) return null;
    const actualQuality =
      RendererFormat.qualityOfLevel(meta.level) ??
      qualities.find((q) => q.br === meta.br)?.label ??
      TrackQuality.h;

    Log.info(
      "_NeteaseAudioSource",
      "latestAudio",
      Log.JsonCompact(
        Log.JsonFlat({
          quality: actualQuality,
          type: meta.type,
          br: meta.br,
          level: meta.level
        })
      )
    );

    return new NeteaseNetworkAudio({
      meta,
      id: track.id,
      url: meta.url,
      quality: actualQuality
    });
  }

  /** 从缓存中加载音频 */
  private static async loadCache(track: NeteaseTrack): Promise<Nullable<NeteaseLocalAudio>> {
    const id = track.id;

    const cache_quality = await this.getResolveCache(track.id);
    const actualQuality = cache_quality ?? this.resolveQuality(track).quality ?? TrackQuality.h;

    const audio_key = this.buildAudioCacheKey({ id, quality: actualQuality });
    const meta_key = this.buildMetaCacheKey({ id, quality: actualQuality });
    const resolve_key = this.buildResolveCacheKey(id);

    const [local, local_meta] = await Promise.all([
      this.getAudioCache({ id, quality: actualQuality }),
      this.getMetaCache({ id, quality: actualQuality })
    ]);
    if (local && local_meta && local?.code === 200 && local.data.ok) {
      Log.debug("_NeteaseAudioSource", "track", "cache hit", audio_key);
      return NeteaseLocalAudio.fromNetwork(
        local_meta,
        RendererCache.service.read.build(local.data.idx.id)
      );
    } else {
      Log.debug("_NeteaseAudioSource", "track", "cache miss", audio_key);
      const ids: string[] = [];
      if (local?.code === 200 && local.data.ok) ids.push(audio_key);
      if (local_meta) ids.push(meta_key);
      if (cache_quality) ids.push(resolve_key);
      ids.length &&
        RendererIdle.normal(() =>
          RendererCache.service.read.remove(ids).catch((err) => {
            Log.error("_NeteaseAudioSource", "track", "cache remove error", ids, err);
          })
        );
    }
    return null;
  }

  /** 保存到缓存 */
  private static async saveCache(networkAudio: NeteaseNetworkAudio, preference?: TrackQuality) {
    return Promise.all([
      _NeteaseAudioSource.storeResolveCache(networkAudio.id, networkAudio.quality, preference),
      _NeteaseAudioSource.storeMetaCache(networkAudio),
      _NeteaseAudioSource.storeAudioCache(networkAudio)
    ]);
  }

  /** 获取音频 */
  static async track(
    track: NeteaseTrack,
    tries: number = 3
  ): Promise<Nullable<NeteaseLocalAudio | NeteaseNetworkAudio>> {
    const cache = await this.loadCache(track);
    return (
      cache ??
      this.latestAudio(track, tries).then((latestMeta) => {
        if (latestMeta) {
          const meta_key = this.buildMetaCacheKey(latestMeta);
          Log.debug("_NeteaseAudioSource", "track", "nocache use network meta", meta_key);
        } else {
          Log.error(
            "_NeteaseAudioSource",
            "track",
            "nocache use network meta",
            "but network meta is null",
            track.id
          );
        }
        return latestMeta;
      })
    );
  }

  /** 下载音频 */
  static download(
    audio: NeteaseNetworkAudio,
    // 最好传偏好，因为可能下载前被修改
    preference?: TrackQuality
  ) {
    return this.saveCache(audio, preference);
  }
}
