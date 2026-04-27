import { CacheStore } from "@mahiru/ui/public/store/cache";
import { TrackQuality } from "@mahiru/ui/public/enum";
import {
  NeteaseLocalAudio,
  NeteaseNetworkAudio,
  NeteaseTrack
} from "@mahiru/ui/public/source/netease/models";

export default class _NeteaseAudioSource {
  //region cache
  private static readonly cacheKey = "netease_audio";

  private static storeCache(audio: NeteaseNetworkAudio) {
    return CacheStore.local.store.one(
      audio.url,
      `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    );
  }

  private static getCache(audio: NeteaseNetworkAudio, download?: boolean) {
    if (download) {
      return CacheStore.local.check.orStoreOne(
        audio.url,
        `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
      );
    }
    return CacheStore.local.check.one(
      `${_NeteaseAudioSource.cacheKey}_${audio.id}_${audio.quality}`
    );
  }
  //endregion

  private static async try(audio: NeteaseNetworkAudio, download: boolean) {
    const check = await _NeteaseAudioSource.getCache(audio, download);
    if (check.ok) {
      return NeteaseLocalAudio.fromNetworkImage(audio, check.index.file);
    }
    return null;
  }

  static async local(track: NeteaseTrack, preference: TrackQuality, download: boolean) {
    const audio = await NeteaseNetworkAudio.fromTrack(track, preference);
    if (!audio) return null;
    return _NeteaseAudioSource.try(audio, download);
  }

  static network(track: NeteaseTrack, preference: TrackQuality) {
    return NeteaseNetworkAudio.fromTrack(track, preference);
  }

  static download(audio: NeteaseNetworkAudio) {
    return _NeteaseAudioSource.storeCache(audio);
  }
}
