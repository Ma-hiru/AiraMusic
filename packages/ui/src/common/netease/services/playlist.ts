import { RendererCache } from "@/common/lib/cache";
import { LRUCacheWithTime } from "@/common/utils/lru";
import { userStoreSnapshot } from "@/common/store/user";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import {
  NeteasePlaylist,
  NeteasePlaylistSummary,
  type NullablePrivilegesPlaylistDetailResponse
} from "@/common/netease/models";
import NeteaseTrackSource from "@/common/netease/services/track";

/**
 * - 歌单元数据使用内存缓存，内存失效时，一定会重新请求元信息，只有歌单中的歌曲信息才会使用本地缓存
 * - 元信息一定是最新的，失效操作只需要清除内存缓存即可
 * */
export default class _NeteasePlaylistSource {
  //region cache
  private static readonly cacheKey = "netease_playlist_detail_v1";

  private static storeCache(response: NullablePrivilegesPlaylistDetailResponse) {
    return RendererCache.service.object.setOne({
      id: _NeteasePlaylistSource.cacheKey + "_" + response.playlist.id,
      data: response
    });
  }

  private static getCache(id: number) {
    return RendererCache.service.object.getOne<NullablePrivilegesPlaylistDetailResponse>(
      _NeteasePlaylistSource.cacheKey + "_" + id
    );
  }

  private static memoryCache = new LRUCacheWithTime<number | string, NeteasePlaylist>(
    10,
    1000 * 60 * 60
  );

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
    response: NullablePrivilegesPlaylistDetailResponse,
    maxPerRequest: number = 100,
    concurrency: number = 5,
    signal?: AbortSignal
  ) {
    signal?.throwIfAborted();
    const { playlist } = response;
    if (playlist.trackCount === playlist.tracks.length) {
      return response;
    }

    const cache = await _NeteasePlaylistSource.getCache(playlist.id);
    signal?.throwIfAborted();
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
      concurrency,
      signal
    );
    signal?.throwIfAborted();

    let index = 0;
    for (const entry of entries) {
      signal?.throwIfAborted();
      if (!entry) {
        // 找不到的歌曲（可能是网络错误、或云端不存在）会被过滤掉，所以需要更新trackCount
        response.playlist.trackIds.splice(index, 1);
        response.playlist.trackCount--;
        continue;
      }
      const { track, privilege } = entry;
      response.playlist.tracks.push(track);
      response.privileges.push(privilege);
      index++;
    }

    window.requestIdleCallback(
      () => {
        if (!signal?.aborted) void _NeteasePlaylistSource.storeCache(response);
      },
      {
        timeout: 1000
      }
    );

    return response;
  }

  static lastLikedCachedID = "";

  /** 仅为摘要卡片读取元信息和少量预览曲目，不补齐整张歌单。 */
  static preview(id: number, limit = 3, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const trackLimit = Number.isFinite(limit) ? Math.min(10, Math.max(0, Math.floor(limit))) : 3;
    return NeteaseAPIPlaylist.detail(id, signal).then((response) => {
      signal?.throwIfAborted();
      const tracks = response.playlist.tracks.slice(0, trackLimit);
      return NeteasePlaylist.fromNeteaseAPIResponse({
        ...response,
        playlist: {
          ...response.playlist,
          tracks
        },
        privileges: response.privileges.slice(0, tracks.length)
      });
    });
  }

  static id(id: number, signal?: AbortSignal, useMemoryCache = true) {
    signal?.throwIfAborted();
    let cachedID: number | string = id;
    // 喜欢的歌曲歌单需要区分喜欢状态的变化，否则喜欢状态无法及时更新
    if (id === _NeteasePlaylistSource.likedPlaylistID) {
      // 使用 likedTrackIDs 的 checkPoint 作为缓存区分，likedTrackIDs 变化时 checkPoint 也会变化，从而使缓存失效，重新获取数据
      cachedID = `${id}_${_NeteasePlaylistSource.likedTrackIDsCheckPoint!}`;
      if (_NeteasePlaylistSource.lastLikedCachedID !== cachedID) {
        /** 兜底，实际上改变like会通知bus，然后使用{@link invalidate} */
        this.memoryCache.delete(_NeteasePlaylistSource.lastLikedCachedID);
      }
      _NeteasePlaylistSource.lastLikedCachedID = cachedID;
    }
    const cache = this.memoryCache.get(cachedID);
    if (cache && useMemoryCache) return Promise.resolve(cache);

    return NeteaseAPIPlaylist.detail(id, signal)
      .then((response) => {
        signal?.throwIfAborted();
        return _NeteasePlaylistSource.response(response, signal);
      })
      .then((response) => {
        signal?.throwIfAborted();
        this.memoryCache.set(cachedID, response);
        return response;
      });
  }

  static response(response: NeteaseAPI.NeteasePlaylistDetailResponse, signal?: AbortSignal) {
    return _NeteasePlaylistSource
      .requestFullTracks(response, 100, 5, signal)
      .then((fullResponse) => {
        signal?.throwIfAborted();
        return NeteasePlaylist.fromNeteaseAPIResponse(fullResponse);
      });
  }

  static summary(summary: NeteasePlaylistSummary | NeteaseAPI.NeteasePlaylistSummary) {
    return _NeteasePlaylistSource.id(summary.id);
  }

  //region 编辑相关
  private static officialTagsCache: Nullable<string[]> = null;

  /** 官方歌单标签列表（缓存），编辑歌单选择 tag 用，网易云只接受官方标签 */
  static async categories(): Promise<string[]> {
    if (_NeteasePlaylistSource.officialTagsCache) return _NeteasePlaylistSource.officialTagsCache;
    const res = await NeteaseAPIPlaylist.category();
    const tags = (res.sub ?? []).map((item) => item.name).filter(Boolean);
    _NeteasePlaylistSource.officialTagsCache = tags;
    return tags;
  }

  /** 编辑歌单后失效内存缓存，使下次 {@link id} 拿到最新元信息 */
  static invalidate(id: number) {
    _NeteasePlaylistSource.memoryCache.delete(id);
    if (id === _NeteasePlaylistSource.likedPlaylistID) {
      this.memoryCache.delete(_NeteasePlaylistSource.lastLikedCachedID);
    }
  }
  //endregion
}
