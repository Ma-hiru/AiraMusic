import NCM_API from "@mahiru/ui/public/api";
import NeteaseTrackSource from "@mahiru/ui/public/entry/source/track";
import {
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteasePlaylistSummary
} from "@mahiru/ui/public/models/netease";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import LRUMap from "@mahiru/ui/public/models/LRU";
import _NeteaseImageSource from "@mahiru/ui/public/entry/source/image";
import ImageConstants from "@mahiru/ui/main/constants/image";

export default class _NeteasePlaylistSource {
  //region cache
  private static readonly cacheKey = "netease_playlist_detail";

  private static storeCache(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return CacheStore.object.store(
      _NeteasePlaylistSource.cacheKey + "_" + response.playlist.id,
      response
    );
  }

  private static getCache(id: number) {
    return CacheStore.object.fetch<NeteaseAPI.NeteasePlaylistDetailResponse>(
      _NeteasePlaylistSource.cacheKey + "_" + id
    );
  }

  private static memoryCache = new LRUMap<number, NeteasePlaylist>(10, 1000 * 60 * 60);
  //endregion
  /** 检查歌单tracks字段是否完整，不完整再额外请求 */
  private static async requestFullTracks(
    response: NeteaseAPI.NeteasePlaylistDetailResponse,
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const { playlist } = response;
    if (playlist.trackCount === playlist.tracks.length) {
      return response;
    }

    const cache = await _NeteasePlaylistSource.getCache(playlist.id);
    if (cache?.playlist.updateTime === playlist.updateTime) {
      response.playlist.tracks = cache.playlist.tracks;
      response.privileges = cache.privileges;

      const cacheCover = NeteaseNetworkImage.fromPlaylistCover(response.playlist);
      _NeteaseImageSource.remove(cacheCover.setSize(ImageConstants.PlaylistPageCoverSize));
      _NeteaseImageSource.remove(cacheCover.setSize(ImageConstants.NavPlaylistCoverSize));

      return response;
    }

    const entries = await NeteaseTrackSource.fromIDsRaw(
      playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
      maxPerRequest,
      concurrency
    );
    for (const { track, privilege } of entries) {
      response.playlist.tracks.push(track);
      response.privileges.push(privilege);
    }

    void _NeteasePlaylistSource.storeCache(response);

    return response;
  }

  static fromID(id: number, signal?: AbortSignal) {
    if (this.memoryCache.has(id)) {
      return Promise.resolve(this.memoryCache.get(id)!);
    }

    return NCM_API.Playlist.detail(id, signal)
      .then((response) => _NeteasePlaylistSource.fromResponse(response))
      .then((response) => {
        this.memoryCache.set(id, response);
        return response;
      });
  }

  static fromResponse(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return _NeteasePlaylistSource
      .requestFullTracks(response)
      .then(NeteasePlaylist.fromNeteaseAPIResponse);
  }

  static fromSummary(summary: NeteasePlaylistSummary | NeteaseAPI.NeteasePlaylistSummary) {
    return _NeteasePlaylistSource.fromID(summary.id);
  }
}
