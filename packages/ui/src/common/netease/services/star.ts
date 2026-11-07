import { LRUCache } from "@/common/utils/lru";
import { NeteaseAPIUser } from "@/common/netease/api";
import { userStoreSnapshot } from "@/common/store/user";
import {
  NeteaseStarAlbum,
  NeteaseStarArtist,
  type NeteaseStarPage,
  type NeteaseUserModel,
  NeteasePlaylistSummary
} from "@/common/netease/models";

const CACHE_TIME = 1000 * 60 * 5;

/**
 * 收藏列表数据源。
 * - 歌单直接派生自用户 store，不做缓存（store 本身是唯一数据源）
 * - 专辑 / 歌手列表按账号和 offset+limit 分页缓存，避免切换 Tab 或返回页面时重复请求
 * - 取消收藏后调用 invalidate 使对应分类的缓存失效
 */
export default class _NeteaseStarSource {
  private static readonly albumsCache = new LRUCache<string, NeteaseStarPage<NeteaseStarAlbum>>({
    capacity: 20,
    time_limit: CACHE_TIME
  });

  private static readonly artistsCache = new LRUCache<string, NeteaseStarPage<NeteaseStarArtist>>({
    capacity: 20,
    time_limit: CACHE_TIME
  });

  /** 通过代际号使旧缓存不可达，避免遍历 LRU 内部节点 */
  private static albumsGeneration = 0;
  private static artistsGeneration = 0;

  private static albumKey(offset: number, limit: number) {
    const userID = userStoreSnapshot()._user?.userId ?? 0;
    return `${userID}:${_NeteaseStarSource.albumsGeneration}:${offset}:${limit}`;
  }

  private static artistKey(offset: number, limit: number) {
    const userID = userStoreSnapshot()._user?.userId ?? 0;
    return `${userID}:${_NeteaseStarSource.artistsGeneration}:${offset}:${limit}`;
  }

  /** 收藏的歌单（用户 store 中非本人创建的歌单） */
  static playlists(user?: Optional<NeteaseUserModel>) {
    const source = user?.starPlaylists ?? userStoreSnapshot()._user?.starPlaylists ?? [];
    return source.map(NeteasePlaylistSummary.fromObject);
  }

  static async albums(
    params: { limit: number; offset?: number },
    signal?: AbortSignal,
    useCache = true
  ): Promise<NeteaseStarPage<NeteaseStarAlbum>> {
    signal?.throwIfAborted();
    const offset = params.offset ?? 0;
    const key = _NeteaseStarSource.albumKey(offset, params.limit);

    if (useCache) {
      const cache = _NeteaseStarSource.albumsCache.get(key);
      if (cache) return cache;
    }

    const response = await NeteaseAPIUser.likedAlbums({ limit: params.limit, offset }, signal);
    signal?.throwIfAborted();

    const items = (response.data ?? []).map(NeteaseStarAlbum.fromNeteaseAPI);
    const page: NeteaseStarPage<NeteaseStarAlbum> = {
      items,
      count: Math.max(response.count ?? 0, items.length),
      hasMore: Boolean(response.hasMore)
    };
    _NeteaseStarSource.albumsCache.set(key, page);
    return page;
  }

  static async artists(
    params: { limit: number; offset?: number },
    signal?: AbortSignal,
    useCache = true
  ): Promise<NeteaseStarPage<NeteaseStarArtist>> {
    signal?.throwIfAborted();
    const offset = params.offset ?? 0;
    const key = _NeteaseStarSource.artistKey(offset, params.limit);

    if (useCache) {
      const cache = _NeteaseStarSource.artistsCache.get(key);
      if (cache) return cache;
    }

    const response = await NeteaseAPIUser.likedArtists({ limit: params.limit, offset }, signal);
    signal?.throwIfAborted();

    const items = (response.data ?? []).map(NeteaseStarArtist.fromNeteaseAPI);
    const page: NeteaseStarPage<NeteaseStarArtist> = {
      items,
      count: Math.max(response.count ?? 0, items.length),
      hasMore: Boolean(response.hasMore)
    };
    _NeteaseStarSource.artistsCache.set(key, page);
    return page;
  }

  static invalidateAlbums() {
    _NeteaseStarSource.albumsGeneration++;
  }

  static invalidateArtists() {
    _NeteaseStarSource.artistsGeneration++;
  }

  static invalidate() {
    _NeteaseStarSource.invalidateAlbums();
    _NeteaseStarSource.invalidateArtists();
  }
}
