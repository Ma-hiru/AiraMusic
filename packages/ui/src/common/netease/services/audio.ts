import { RendererCache } from "@/common/lib/cache";
import { TrackQuality } from "@/common/enum";
import {
  NeteaseLocalAudio,
  NeteaseNetworkAudio,
  NeteaseTrack,
  NeteaseUser
} from "@/common/netease/models";
import { NeteaseAPITrack } from "@/common/netease/api";
import { userStoreSnapshot } from "@/common/store/user";

export default class _NeteaseAudioSource {
  //region cache
  private static readonly cacheKey = "netease_audio";

  private static storeMetaCache(audio: NeteaseNetworkAudio) {
    RendererCache.memory.setOne(this.cacheKey + audio.id + audio.quality, audio);
  }

  private static getMetaCache(track: NeteaseTrack, preference: TrackQuality) {
    return RendererCache.memory.getOne<NeteaseNetworkAudio>(this.cacheKey + track.id + preference);
  }

  private static storeAudioCache(audio: NeteaseNetworkAudio) {
    return RendererCache.local.store.one(
      audio.url,
      `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    );
  }

  private static getAudioCache(audio: NeteaseNetworkAudio, download?: boolean) {
    if (download) {
      return RendererCache.local.check.orStoreOne(
        audio.url,
        `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
      );
    }
    return RendererCache.local.check.one(
      `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    );
  }
  //endregion

  private static async latestAudio(track: NeteaseTrack, preference: TrackQuality) {
    track = NeteaseTrack.fromObject(track);
    const isVip = NeteaseUser.isVIP(userStoreSnapshot()._user);
    const qualities = track.qualities(isVip);
    const quality = qualities.find((q) => q.label === preference) ?? qualities[0];
    const urlResponse = await NeteaseAPITrack.url(track.id, quality);
    const meta = urlResponse.data[0];
    if (!meta) return null;
    return new NeteaseNetworkAudio({
      id: track.id,
      url: meta.url,
      quality: qualities.find((q) => q.br === meta.br)?.label ?? TrackQuality.h
    });
  }

  static async track(
    track: NeteaseTrack,
    preference: TrackQuality,
    download: boolean
  ): Promise<Nullable<NeteaseNetworkAudio | NeteaseLocalAudio>> {
    const meta =
      this.getMetaCache(track, preference) ?? (await this.latestAudio(track, preference));
    if (!meta) return null;

    const check = await this.getAudioCache(meta, download);
    if (check.ok) return NeteaseLocalAudio.fromNetwork(meta, check.index.file);

    return meta;
  }

  static download(audio: NeteaseNetworkAudio) {
    return _NeteaseAudioSource.storeAudioCache(audio);
  }
}
