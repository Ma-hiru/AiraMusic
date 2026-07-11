import { RendererCache } from "@/common/lib/cache";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPITrack } from "@/common/netease/api";
import { userStoreSnapshot } from "@/common/store/user";
import { TrackQuality, StoreCategory } from "@/common/enum";
import {
  NeteaseUser,
  NeteaseTrack,
  NeteaseLocalAudio,
  NeteaseNetworkAudio
} from "@/common/netease/models";

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
    return RendererCache.service.save.url([
      {
        url: audio.url,
        id: `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`,
        category: StoreCategory.Audio
      }
    ]);
  }

  private static getAudioCache(audio: NeteaseNetworkAudio, download?: boolean) {
    if (download) {
      return RendererCache.service.check.readOrStoreOne({
        url: audio.url,
        id: `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`,
        category: StoreCategory.Audio
      });
    }
    return RendererCache.service.check.readOne({
      id: `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    });
  }
  //endregion

  private static async latestAudio(track: NeteaseTrack, preference: TrackQuality) {
    track = NeteaseTrack.fromObject(track);
    const isVip = NeteaseUser.isVIP(userStoreSnapshot()._user);
    const qualities = track.qualities(isVip);
    const quality = qualities.find((q) => q.label === preference) ?? qualities[0];
    const urlResponse = await NeteaseAPITrack.urlNew(
      track.id,
      RendererFormat.musicLevel(quality?.label ?? TrackQuality.h)
    );
    const meta = urlResponse.data[0];
    if (!meta || !meta.url) return null;
    return new NeteaseNetworkAudio({
      meta,
      id: track.id,
      url: meta.url,
      quality: qualities.find((q) => q.br === meta.br)?.label ?? TrackQuality.h
    });
  }

  static async track(
    track: NeteaseTrack,
    preference: TrackQuality,
    download: boolean
  ): Promise<Nullable<NeteaseLocalAudio | NeteaseNetworkAudio>> {
    const meta =
      this.getMetaCache(track, preference) ?? (await this.latestAudio(track, preference));
    if (!meta) return null;

    const check = await this.getAudioCache(meta, download);
    if (check.code === 200 && check.data.ok) {
      return NeteaseLocalAudio.fromNetwork(
        meta,
        RendererCache.service.read.build(check.data.idx.id)
      );
    }

    return meta;
  }

  static download(audio: NeteaseNetworkAudio) {
    return _NeteaseAudioSource.storeAudioCache(audio);
  }
}
