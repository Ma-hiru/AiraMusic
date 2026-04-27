import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import NeteaseTrackSource from "@mahiru/ui/public/source/netease/services/track";
import { NeteasePlaylist, NeteasePlaylistSummary } from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { LRUCacheWithTime } from "@mahiru/ui/public/utils/lru";
import { userStoreSnapshot } from "../../../store/user";

export default class _NeteasePlaylistSource {
  //region cache
  private static readonly cacheKey = "netease_playlist_detail_v1";

  private static storeCache(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return CacheStore.local.object.store(
      _NeteasePlaylistSource.cacheKey + "_" + response.playlist.id,
      response
    );
  }

  private static getCache(id: number) {
    return CacheStore.local.object.fetch<NeteaseAPI.NeteasePlaylistDetailResponse>(
      _NeteasePlaylistSource.cacheKey + "_" + id
    );
  }

  private static memoryCache = new LRUCacheWithTime<number, NeteasePlaylist>(10, 1000 * 60 * 60);

  private static get userStore() {
    return userStoreSnapshot();
  }

  private static get likedPlaylistID() {
    return this.userStore._user?.likedPlaylist.id ?? -1;
  }

  private static get likedTrackIDsCheckPoint() {
    return this.userStore._user?.likedTrackIDs.checkPoint ?? 0;
  }
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
    if (
      cache?.playlist.updateTime === playlist.updateTime &&
      cache.playlist.trackNumberUpdateTime === playlist.trackNumberUpdateTime &&
      cache.playlist.trackUpdateTime === playlist.trackUpdateTime
    ) {
      response.privileges = cache.privileges;
      response.playlist.tracks = cache.playlist.tracks;
      response.playlist.trackCount = cache.playlist.trackCount;
      response.playlist.trackIds = cache.playlist.trackIds;
      return response;
    }

    const entries = await NeteaseTrackSource._raw(
      playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
      maxPerRequest,
      concurrency
    );

    let index = 0;
    for (const entry of entries) {
      if (!entry) {
        // 存在歌曲下架的情况，找不到的歌曲会被过滤掉，所以需要更新trackCount
        response.playlist.trackIds.splice(index, 1);
        response.playlist.trackCount--;
        continue;
      }
      const { track, privilege } = entry;
      response.playlist.tracks.push(track);
      response.privileges.push(privilege);
      index++;
    }

    window.requestIdleCallback(() => _NeteasePlaylistSource.storeCache(response), {
      timeout: 1000
    });

    return response;
  }

  static id(id: number, signal?: AbortSignal) {
    let cachedID = id;
    // 喜欢的歌曲歌单需要区分喜欢状态的变化，否则喜欢状态无法及时更新
    if (id === _NeteasePlaylistSource.likedPlaylistID) {
      // 使用 likedTrackIDs 的 checkPoint 作为缓存区分，likedTrackIDs 变化时 checkPoint 也会变化，从而使缓存失效，重新获取数据
      cachedID = id + _NeteasePlaylistSource.likedTrackIDsCheckPoint!;
    }
    const cache = this.memoryCache.get(cachedID);
    if (cache) return Promise.resolve(cache);

    return NeteaseAPI.Playlist.detail(id, signal)
      .then((response) => _NeteasePlaylistSource.response(response))
      .then((response) => {
        this.memoryCache.set(cachedID, response);
        return response;
      });
  }

  static response(response: NeteaseAPI.NeteasePlaylistDetailResponse) {
    return _NeteasePlaylistSource
      .requestFullTracks(response)
      .then(NeteasePlaylist.fromNeteaseAPIResponse);
  }

  static summary(summary: NeteasePlaylistSummary | NeteaseAPI.NeteasePlaylistSummary) {
    return _NeteasePlaylistSource.id(summary.id);
  }
}
