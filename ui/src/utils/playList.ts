import {
  ImageSize,
  NeteasePlaylistToFullTracksFilter,
  NeteaseTrackCoverPreCacheFilter,
  NeteaseTracksPrivilegeExtendsFilter
} from "@mahiru/ui/utils/filter";
import { Log } from "@mahiru/ui/utils/dev";
import { getPlaylistDetail } from "@mahiru/ui/api/playlist";
import { CacheStore, getDynamicSnapshot } from "@mahiru/ui/store";

export type PlaylistCacheID = `play_list_cache_${string | number}`;

export type PlaylistCacheEntry = {
  readonly playlistId: number;
  readonly playlistCacheId: PlaylistCacheID;
  readonly playlist: NeteasePlaylistDetail;
  readonly privileges: NeteaseTrackPrivilege[];
  readonly createTime: number;
  _dirty: boolean;
};

class _PlaylistStore {
  /** 内存中最多存储的歌单数目 */
  maxMemorySize = 5;
  /** 超过限制强制存在Store里面，而不是内存 */
  maxPlayListSize = 500;
  /** 缓存过期时间 */
  timeLimit = 1000 * 60 * 60; // 1 hour
  memory = new Map<PlaylistCacheID, PlaylistCacheEntry>();

  createEntry(data: NeteasePlaylistDetailResponse): PlaylistCacheEntry {
    const cacheID = this.cacheID(data.playlist.id);
    return {
      playlistId: data.playlist.id,
      playlistCacheId: cacheID,
      playlist: data.playlist,
      privileges: data.privileges,
      createTime: Date.now(),
      _dirty: false
    };
  }

  /** 将内存中的更新保存到Store */
  updateInStore(entry: PlaylistCacheEntry) {
    if (entry._dirty) {
      entry._dirty = false;
      this.setInStore(entry);
    }
  }

  async set(entry: PlaylistCacheEntry) {
    if (entry.playlist.trackCount <= this.maxPlayListSize) {
      this.setInMemory(entry);
    }
    this.setInStore(entry);
  }

  async get(id: number) {
    const cacheID = this.cacheID(id);
    const memory = this.getInMemory(cacheID);
    if (memory) {
      Log.info("PlaylistManager", "从内存获取歌单缓存", id);
      return memory;
    }
    const store = await this.getInStore(cacheID);
    if (store) {
      Log.info("PlaylistManager", "从存储获取歌单缓存", id);
      return store;
    }
    Log.info("PlaylistManager", "未命中歌单缓存", id);
    return null;
  }

  outdate(entry: PlaylistCacheEntry) {
    return Date.now() - entry.createTime > this.timeLimit;
  }

  cacheID(playListID: number): PlaylistCacheID {
    return `play_list_cache_${playListID}`;
  }

  limitMemorySize() {
    if (this.memory.size >= this.maxMemorySize) {
      // 删除最久未使用的
      let LRUKey: PlaylistCacheID | undefined;
      for (const entry of this.memory.values()) {
        if (!LRUKey || entry.createTime < this.memory.get(LRUKey)!.createTime) {
          LRUKey = entry.playlistCacheId;
        }
      }
      this.memory.delete(LRUKey!);
    }
  }

  setInMemory(data: PlaylistCacheEntry) {
    this.limitMemorySize();
    this.memory.set(data.playlistCacheId, data);
  }

  setInStore(data: PlaylistCacheEntry) {
    void CacheStore.storeObject(data.playlistCacheId, data);
  }

  getInMemory(id: PlaylistCacheID) {
    const entry = this.memory.get(id);
    if (!entry) return null;
    if (this.outdate(entry)) {
      this.memory.delete(id);
      return null;
    }
    return entry;
  }

  async getInStore(id: PlaylistCacheID) {
    return await CacheStore.fetchObject<PlaylistCacheEntry>(id, this.timeLimit);
  }
}

class _PlaylistManager {
  store = new _PlaylistStore();

  async requestPlayListDetailWithStore(
    id: number,
    preloadRange: [start: number, end: number],
    size: ImageSize = ImageSize.xs
  ) {
    const cache = await this.store.get(id);
    if (cache) {
      return cache;
    } else {
      const rawList = await getPlaylistDetail(id);
      const fullList = await NeteasePlaylistToFullTracksFilter({ ...rawList });
      fullList.playlist.tracks = NeteaseTracksPrivilegeExtendsFilter(
        fullList.playlist.tracks,
        fullList.privileges
      );
      fullList.playlist.tracks = await NeteaseTrackCoverPreCacheFilter(
        fullList.playlist.tracks,
        preloadRange,
        size
      );
      const entry = this.store.createEntry(fullList);
      await this.store.set(entry);
      return entry;
    }
  }

  async saveDirtyPlaylistEntry(entry: PlaylistCacheEntry) {
    return this.store.updateInStore(entry);
  }

  updatePlaylistEntryTrackCoverCache(props: {
    entry: PlaylistCacheEntry;
    absoluteIndex: number;
    cachedPicUrl: string;
    cachedPicUrlID: string;
  }) {
    const { entry, absoluteIndex, cachedPicUrlID, cachedPicUrl } = props;
    const track = entry.playlist.tracks[absoluteIndex];
    if (track) {
      track.al.cachedPicUrl = cachedPicUrl;
      if (cachedPicUrlID === "" && track.al.cachedPicUrlID) {
        void CacheStore.remove(track.al.cachedPicUrlID);
      }
      track.al.cachedPicUrlID = cachedPicUrlID;
      entry._dirty = true;
    }
  }

  async updatePlaylistEntryTrackLikedStatus(props: { track: NeteaseTrack; nextStatus: boolean }) {
    const { track, nextStatus } = props;
    const { userLikedPlayList } = getDynamicSnapshot();
    const likedPlaylistID = userLikedPlayList?.id;
    if (likedPlaylistID) {
      const entry = await this.store.get(likedPlaylistID);
      if (entry) {
        const findTrackIndex = entry.playlist.tracks.findIndex((t) => t.id === track.id);
        if (!nextStatus && findTrackIndex !== -1) {
          // 取消喜欢时，在喜欢的音乐列表中找到了该歌曲，需要移除
          entry.playlist.tracks.splice(findTrackIndex, 1);
        } else if (nextStatus && findTrackIndex === -1) {
          // 新喜欢时，如果在喜欢的音乐列表中找不到该歌曲，需要添加进去
          entry.playlist.tracks.unshift(track);
        }
        entry._dirty = true;
        await this.saveDirtyPlaylistEntry(entry);
      }
    }
  }
}

export const PlaylistManager = new _PlaylistManager();
