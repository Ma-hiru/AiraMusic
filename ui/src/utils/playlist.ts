import { EqError, Log } from "@mahiru/ui/utils/dev";
import { Time } from "@mahiru/ui/utils/time";
import { API } from "@mahiru/ui/api";
import { startTransition } from "react";
import { NeteaseImage, NeteaseImageSize } from "@mahiru/ui/utils/image";
import { NeteaseTrack } from "@mahiru/ui/utils/track";
import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";

export type PlaylistCacheID = `play_list_cache_${string | number}`;

export type PlaylistCacheEntry = {
  readonly playlistId: number;
  readonly playlistCacheId: PlaylistCacheID;
  readonly playlist: NeteasePlaylistDetail;
  readonly privileges: NeteaseTrackPrivilege[];
  readonly createTime: number;
  _dirty: boolean;
};

@AddStoreSnapshot
class PlaylistStore {
  /** 内存中最多存储的歌单数目 */
  _maxMemorySize = 3;
  /** 超过限制强制存在Store里面，而不是内存 */
  _maxPlayListSize = 100;
  /** 缓存过期时间 */
  _timeLimit = Time.getCacheTimeLimit(1, "day");

  _memory = new Map<PlaylistCacheID, PlaylistCacheEntry>();

  createEntry(data: NeteasePlaylistDetailResponse): PlaylistCacheEntry {
    const cacheID = this.getEntryCacheID(data.playlist.id);
    return {
      playlistId: data.playlist.id,
      playlistCacheId: cacheID,
      playlist: data.playlist,
      privileges: data.privileges,
      createTime: Date.now(),
      _dirty: false
    };
  }

  saveDirtyEntry(entry: PlaylistCacheEntry, memoryFresh = false) {
    if (entry._dirty) {
      entry._dirty = false;
      this.setInStore(entry);
      if (memoryFresh) {
        this.setInMemory(entry);
      }
    }
  }

  setEntry(entry: PlaylistCacheEntry) {
    if (entry.playlist.trackCount <= this._maxPlayListSize) {
      this.setInMemory(entry);
    }
    this.setInStore(entry);
  }

  async getEntry(id: number) {
    const cacheID = this.getEntryCacheID(id);
    const memory = this.getInMemory(cacheID);
    if (memory) {
      Log.info("PlaylistManager", "从内存获取歌单缓存", id);
      return memory;
    }
    const store = await this.getInStore(cacheID);
    if (store) {
      Log.trace("PlaylistManager", "从存储获取歌单缓存", id);
      return store;
    }
    Log.trace("PlaylistManager", "未命中歌单缓存", id);
    return null;
  }

  removeEntry(entry: PlaylistCacheEntry | number) {
    if (typeof entry === "number") {
      const cacheID = this.getEntryCacheID(entry);
      this._memory.delete(cacheID);
      void this.cacheStore.remove(cacheID);
    } else {
      this._memory.delete(entry.playlistCacheId);
      void this.cacheStore.remove(entry.playlistCacheId);
    }
  }

  private getEntryCacheID(playlist: number | PlaylistCacheEntry): PlaylistCacheID {
    if (typeof playlist === "object" && "playlistId" in playlist) {
      return `play_list_cache_${playlist.playlistId}`;
    }
    return `play_list_cache_${playlist}`;
  }

  private isEntryOutdate(entry: PlaylistCacheEntry) {
    return Date.now() - entry.createTime > this._timeLimit;
  }

  private limitMemorySize() {
    if (this._memory.size >= this._maxMemorySize) {
      // 删除最久未使用的
      let LRUKey: PlaylistCacheID | undefined;
      for (const entry of this._memory.values()) {
        if (!LRUKey || entry.createTime < this._memory.get(LRUKey)!.createTime) {
          LRUKey = entry.playlistCacheId;
        }
      }
      this._memory.delete(LRUKey!);
    }
  }

  private setInMemory(data: PlaylistCacheEntry) {
    this.limitMemorySize();
    this._memory.set(data.playlistCacheId, data);
  }

  private setInStore(data: PlaylistCacheEntry) {
    void this.cacheStore.storeObject(data.playlistCacheId, data);
  }

  private getInMemory(id: PlaylistCacheID) {
    const entry = this._memory.get(id);
    if (!entry) return null;
    if (this.isEntryOutdate(entry)) {
      this._memory.delete(id);
      return null;
    }
    return entry;
  }

  private getInStore(id: PlaylistCacheID) {
    return this.cacheStore.fetchObject<PlaylistCacheEntry>(id, this._timeLimit);
  }
}
interface PlaylistStore extends WithStoreSnapshot {}

@AddStoreSnapshot
class PlaylistManager {
  private store = new PlaylistStore();
  private outerUpdaterWithID: Map<number, NormalFunc> = new Map();
  private outerUpdaterWithAll: Set<NormalFunc> = new Set();
  private controller: AbortController = new AbortController();
  private lastCheck: Nullable<{ id: number; time: number }> = null;

  /// 外部更新器管理
  addOuterUpdater(func: NormalFunc, id: Optional<number>) {
    if (id) {
      this.outerUpdaterWithID.set(id, func);
    } else {
      this.outerUpdaterWithAll.add(func);
    }
  }

  removeOuterUpdater(func: Optional<NormalFunc>, id: Optional<number>) {
    if (id) {
      this.outerUpdaterWithID.delete(id);
    } else if (func) {
      this.outerUpdaterWithAll.delete(func);
    }
  }

  private execUpdater(id: Optional<number>) {
    startTransition(() => {
      if (id) {
        try {
          this.outerUpdaterWithID.get(id)?.();
        } catch (err) {
          Log.error(
            new EqError({
              raw: err,
              message: "PlaylistManager execUpdater failed",
              label: "ui/store/playlist.ts:PlaylistManager.execUpdater"
            })
          );
          this.removeOuterUpdater(null, id);
        }
      }
      this.outerUpdaterWithAll.forEach((func) => {
        try {
          func();
        } catch (err) {
          Log.error(
            new EqError({
              raw: err,
              message: "PlaylistManager execUpdater failed",
              label: "ui/store/playlist.ts:PlaylistManager.execUpdater"
            })
          );
          this.removeOuterUpdater(func, null);
        }
      });
    });
  }

  /// 歌单请求部分
  /** 请求歌单数据 */
  public async requestPlaylistDetail(
    id: number,
    preloadRange: [start: number, end: number],
    size: NeteaseImageSize = NeteaseImageSize.xs,
    whenRequestMissedTracks?: NormalFunc<[missTrack: number]>,
    noCache = false
  ) {
    const cache = await this.store.getEntry(id);
    if (cache && !noCache) {
      this.checkShouldUpdate(cache, async (response, signal) => {
        const fullList = await this.requestFullTracks(response, undefined, 100, 2);
        fullList.playlist.tracks = NeteaseTrack.tracksPrivilegeExtends(
          fullList.playlist.tracks,
          fullList.privileges
        );
        if (signal.aborted) return;
        fullList.playlist.tracks = await this.requestTracksCoverPreCache(
          fullList.playlist.tracks,
          preloadRange,
          size
        );
        if (signal.aborted) return;
        const entry = this.store.createEntry(fullList);
        this.store.setEntry(entry);
        startTransition(() => {
          if (signal.aborted) return;
          this.execUpdater(id);
        });
      });
      return cache;
    } else {
      const rawList = await API.Playlist.getPlaylistDetail(id);
      const fullList = await this.requestFullTracks({ ...rawList }, whenRequestMissedTracks);
      fullList.playlist.tracks = NeteaseTrack.tracksPrivilegeExtends(
        fullList.playlist.tracks,
        fullList.privileges
      );
      fullList.playlist.tracks = await this.requestTracksCoverPreCache(
        fullList.playlist.tracks,
        preloadRange,
        size
      );
      const entry = this.store.createEntry(fullList);
      this.store.setEntry(entry);
      return entry;
    }
  }

  private checkShouldUpdate(
    cache: PlaylistCacheEntry,
    cb: PromiseFunc<[newDetail: NeteasePlaylistDetailResponse, signal: AbortSignal]>
  ) {
    if (
      this.lastCheck?.id === cache.playlistId &&
      Date.now() - this.lastCheck.time < Time.getCacheTimeLimit(5, "seconds")
    )
      return;

    this.lastCheck = { id: cache.playlistId, time: Date.now() };
    this.controller.abort();
    this.controller = new AbortController();
    const signal = this.controller.signal;
    API.Playlist.getPlaylistDetail(cache.playlistId, signal)
      .then((response) => {
        if (signal.aborted) return;
        if (response.playlist.trackCount !== cache.playlist.trackCount)
          void cb(response, this.controller.signal);
        const result = response.playlist.tracks.find((track, i) => {
          const cacheTrack = cache.playlist.tracks[i];
          return !cacheTrack || track.id !== cacheTrack.id;
        });
        if (result) void cb(response, this.controller.signal);
      })
      .catch((err) => {
        if (signal.aborted) return;
        Log.error(
          new EqError({
            raw: err,
            message: "failed to check playlist update",
            label: "playlist.ts:PlaylistManager.checkShouldUpdate"
          })
        );
      });
  }

  public async forceFetchLatestData(
    id: number,
    preloadRange: [start: number, end: number],
    size: NeteaseImageSize = NeteaseImageSize.xs,
    whenRequestMissedTracks?: NormalFunc<[missTrack: number]>
  ) {
    this.store.removeEntry(id);
    const entry = await this.requestPlaylistDetail(
      id,
      preloadRange,
      size,
      whenRequestMissedTracks,
      true
    );
    startTransition(() => {
      this.execUpdater(id);
      this.execUpdater(null);
    });
    return entry;
  }

  /** 更新喜欢歌曲 */
  public async updateTrackLikedStatus(props: { track: NeteaseTrack; nextStatus: boolean }) {
    const { track, nextStatus } = props;
    const { UserLikedListSummary } = this.userSnapshot;
    const likedPlaylistID = UserLikedListSummary?.id;
    if (likedPlaylistID) {
      const entry = await this.store.getEntry(likedPlaylistID);
      if (entry) {
        const findTrackIndex = entry.playlist.tracks.findIndex((t) => t.id === track.id);
        if (!nextStatus && findTrackIndex !== -1) {
          // 取消喜欢时，在喜欢的音乐列表中找到了该歌曲，需要移除
          Log.trace("取消喜欢歌曲", "找到喜欢列表歌曲，移除", track.id);
          entry.playlist.tracks.splice(findTrackIndex, 1);
        } else if (nextStatus) {
          // 新喜欢时，如果在喜欢的音乐列表中找不到该歌曲，需要添加进去
          if (findTrackIndex === -1) {
            Log.trace("喜欢歌曲", "找不到喜欢的音乐列表中的歌曲，添加进去", track.id);
            entry.playlist.tracks.unshift(track);
          } else {
            // 已经存在喜欢的列表中，需要提前到歌单顶部
            Log.trace("喜欢歌曲", "喜欢的音乐列表中已经存在该歌曲，提前到歌单顶部", track.id);
            const [likedTrack] = entry.playlist.tracks.splice(findTrackIndex, 1);
            likedTrack && entry.playlist.tracks.unshift(likedTrack);
          }
        }
        entry._dirty = true;
        this.saveDirtyEntry(entry, true);
        startTransition(() => {
          this.execUpdater(likedPlaylistID);
          this.execUpdater(null);
        });
      }
    }
  }

  /** 检查歌单tracks字段是否完整，不完整再额外请求 */
  private async requestFullTracks(
    response: NeteasePlaylistDetailResponse,
    whenRequestMissedTracks?: NormalFunc<[missTrack: number]>,
    maxPerRequest: number = 100,
    concurrency: number = 5
  ) {
    const { playlist } = response;
    if (playlist.trackCount === playlist.tracks.length) {
      return response;
    } else {
      whenRequestMissedTracks?.(playlist.trackCount - playlist.tracks.length);
      const { tracks, privilege } = await NeteaseTrack.requestTrackDetail(
        playlist.trackIds.slice(playlist.tracks.length, playlist.trackCount),
        maxPerRequest,
        concurrency
      );
      response.playlist.tracks.push(...tracks);
      response.privileges.push(...privilege);
      return response;
    }
  }

  /** 歌曲封面缓存，命中则替换成本地路径，没有就预下载 */
  public async requestTracksCoverPreCache(
    tracks: NeteaseTrack[],
    range: [start: number, end: number],
    size: NeteaseImageSize = NeteaseImageSize.xs,
    noStore = false
  ) {
    // range => [start, end)
    let [start, end] = range;
    // 边界检查
    if (start >= end || start >= tracks.length || end <= 0) return tracks;
    if (end > tracks.length) end = tracks.length;
    if (start < 0) start = 0;
    // 构建检查列表
    const coverURLs = tracks.slice(start, end).map((track) => {
      const url = NeteaseImage.setSize(track.al.picUrl, size);
      return {
        id: url,
        url
      };
    });
    // 检查或预缓存
    let check;
    try {
      if (noStore) check = await this.cacheStore.checkMulti(coverURLs);
      else check = await this.cacheStore.checkOrStoreAsyncMulti(coverURLs, "GET");
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: "failed to pre-cache track cover images",
          label: "filter.ts:NeteaseTrackCoverPreCacheFilter"
        })
      );
      check = { ok: false, results: [] };
    }
    // 写入结果
    if (check.ok) {
      check.results.forEach((cache, i) => {
        if (cache.ok) {
          NeteaseImage.storeCacheURL(coverURLs[i]?.url, cache.index.file);
        }
      });
    }

    return tracks;
  }

  /// Utils
  saveDirtyEntry(entry: PlaylistCacheEntry, memoryFresh = false) {
    return this.store.saveDirtyEntry(entry, memoryFresh);
  }

  formatPlayCount(playcount?: number): string {
    if (!playcount) return "0";
    if (playcount >= 100000000) {
      return (playcount / 100000000).toFixed(1) + "亿";
    } else if (playcount >= 10000) {
      return (playcount / 10000).toFixed(1) + "万";
    } else {
      return playcount.toString();
    }
  }
}
interface PlaylistManager extends WithStoreSnapshot {}

export const Playlist = new PlaylistManager();
