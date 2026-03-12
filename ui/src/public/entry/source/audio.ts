import { CacheStore } from "@mahiru/ui/public/store/cache";
import { TrackQuality } from "@mahiru/ui/public/enum";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";
import {
  NeteaseLocalAudio,
  NeteaseNetworkAudio
} from "@mahiru/ui/public/models/netease/NeteaseAudio";

export default class NeteaseAudioSource {
  //region cache
  private static readonly cacheKey = "netease_audio";

  private static storeCache(audio: NeteaseNetworkAudio) {
    return CacheStore.store.one(
      audio.url,
      `${NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    );
  }

  private static getCache(audio: NeteaseNetworkAudio, download?: boolean) {
    if (download) {
      return CacheStore.check.orStoreOne(
        audio.url,
        `${NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
      );
    }
    return CacheStore.check.one(`${NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`);
  }
  //endregion

  static async try(audio: NeteaseNetworkAudio, download: boolean) {
    const check = await NeteaseAudioSource.getCache(audio, download);
    if (check.ok) {
      return NeteaseLocalAudio.fromNetworkImage(audio, check.index.file);
    }
    return null;
  }

  static async tryFromTrack(track: NeteaseTrack, preference: TrackQuality, download: boolean) {
    const audio = await NeteaseNetworkAudio.fromTrack(track, preference);
    if (!audio) return null;
    return NeteaseAudioSource.try(audio, download);
  }

  static downloadAudio(audio: NeteaseNetworkAudio) {
    return NeteaseAudioSource.storeCache(audio);
  }
}
