import NeteasePlaylistSummary from "@mahiru/ui/public/models/netease/NeteasePlaylistSummary";
import NCM_API from "@mahiru/ui/public/api";
import NeteasePlaylist from "@mahiru/ui/public/models/netease/NeteasePlaylist";
import NeteaseTrackSource from "@mahiru/ui/public/entry/source/track";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class NeteasePlaylistSource {
  static readonly cacheKey = "playlist_detail";

  static storeCache(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return CacheStore.object.store(
      NeteasePlaylistSource.cacheKey + "_" + response.playlist.id,
      response
    );
  }

  static getCache(id: number) {
    return CacheStore.object.fetch<NeteaseAPI.NeteasePlaylistDetailResponse>(
      NeteasePlaylistSource.cacheKey + "_" + id
    );
  }

  /** 检查歌单tracks字段是否完整，不完整再额外请求 */
  static async requestFullTracks(
    response: NeteaseAPI.NeteasePlaylistDetailResponse,
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const { playlist } = response;
    if (playlist.trackCount === playlist.tracks.length) {
      return response;
    }

    const cache = await NeteasePlaylistSource.getCache(playlist.id);
    if (cache?.playlist.updateTime === playlist.updateTime) {
      return cache;
    }

    const { tracks, privileges } = await NeteaseTrackSource.fromIDsRaw(
      playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
      maxPerRequest,
      concurrency
    );
    response.playlist.tracks.push(...tracks);
    response.privileges.push(...privileges);

    void NeteasePlaylistSource.storeCache(response);

    return response;
  }

  formID(id: number, signal?: AbortSignal) {
    return NCM_API.Playlist.detail(id, signal).then(this.fromResponse.bind(this));
  }

  fromResponse(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return NeteasePlaylistSource.requestFullTracks(response).then(
      NeteasePlaylist.fromNeteaseAPIResponse
    );
  }

  fromSummary(summary: NeteasePlaylistSummary | NeteaseAPI.NeteasePlaylistSummary) {
    return this.formID(summary.id);
  }
}
