import { getPlayerStatusSnapshot } from "@mahiru/ui/store";
import { CacheStore } from "@mahiru/ui/store/cache";
import { startTransition } from "react";

type CacheType = {
  _position: number;
  _playlist: PlayerTrackStatus[];
  _shuffle: boolean;
  _repeat: "off" | "one" | "all";
  playerStatus: PlayerStatus;
  playerProgress: PlayerProgress;
  trackStatus: Nullable<PlayerTrackStatus>;
};

export const Player = new (class {
  private _cacheKey = "playlist_player_manager";
  private _position: number = -1;
  private _playlist: PlayerTrackStatus[] = [];
  private _shuffle: boolean = false;
  private _repeat: "off" | "one" | "all" = "off";
  private _outerTrackUpdater: NormalFunc<
    [updater: NormalFunc<[draft: Nullable<PlayerTrackStatus>], void | Nullable<PlayerTrackStatus>>]
  > | null = null;
  private _outerStatusUpdater: NormalFunc<
    [updater: NormalFunc<[draft: PlayerStatus], void | PlayerStatus>]
  > | null = null;
  private _beforeTrackUpdate: NormalFunc<[next: Nullable<PlayerTrackStatus>]> | null = null;

  private updateOuter() {
    startTransition(() => {
      const current = this.current();
      this._outerTrackUpdater?.((draft) => {
        if (draft && draft.track.id === current?.track.id) return;
        this._beforeTrackUpdate?.(current);
        return current;
      });
      this._outerStatusUpdater?.((draft) => {
        if (draft.repeat !== this._repeat) {
          draft.repeat = this._repeat;
        }
        if (draft.shuffle !== this._shuffle) {
          draft.shuffle = this._shuffle;
        }
        if (draft.position !== this._position) {
          draft.position = this._position;
        }
      });
    });
  }

  private setPlayingStatus(playing: boolean) {
    startTransition(() => {
      this._outerStatusUpdater?.((draft) => {
        draft.playing = playing;
      });
    });
  }

  private async loadFromCache() {
    const { playerProgress, setPlayerStatus, setTrackStatus, setPlayerInitialized } =
      getPlayerStatusSnapshot();
    const cache = await CacheStore.fetchObject<CacheType>(this._cacheKey);
    if (cache) {
      this._position = cache._position;
      this._playlist = cache._playlist;
      this._shuffle = cache._shuffle;
      this._repeat = cache._repeat;
      const { currentTime, duration, buffered, size } = cache.playerProgress;
      playerProgress.current().currentTime = currentTime;
      playerProgress.current().duration = duration;
      playerProgress.current().buffered = buffered;
      playerProgress.current().size = size;
      setPlayerStatus(() => {
        cache.playerStatus.playing = false;
        return cache.playerStatus;
      });
      setTrackStatus(() => cache.trackStatus);
    }
    setPlayerInitialized(true);
    this.updateOuter();
  }

  async init() {
    const { setTrackStatus, setPlayerStatus, beforeTrackUpdate } = getPlayerStatusSnapshot();
    this._outerTrackUpdater = setTrackStatus;
    this._outerStatusUpdater = setPlayerStatus;
    this._beforeTrackUpdate = beforeTrackUpdate;
    await this.loadFromCache();
  }

  async saveToCache() {
    const { playerStatus, playerProgress, trackStatus } = getPlayerStatusSnapshot();
    await CacheStore.storeObject(this._cacheKey, {
      _position: this._position,
      _playlist: this._playlist,
      _shuffle: this._shuffle,
      _repeat: this._repeat,
      playerStatus,
      trackStatus,
      playerProgress: playerProgress.current()
    } satisfies CacheType);
  }

  replacePlaylist(
    list: NeteaseTrack[] | PlayerTrackStatus[],
    source: Optional<number> = undefined,
    initPosition: number = -1
  ) {
    const firstElement = list?.[0];
    if (!firstElement) return this.current();
    if ("source" in firstElement && firstElement.track) {
      // Player已经是TrackStatus类型
      if (source !== undefined) {
        // 需要替换source
        this._playlist = (list as PlayerTrackStatus[]).map((item) => {
          return {
            ...item,
            source: source as number | null
          };
        });
      } else {
        this._playlist = list as PlayerTrackStatus[];
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      this._playlist = (list as NeteaseTrack[]).map((track) => {
        return {
          source: source as number | null,
          track,
          lyric: {
            full: [],
            rm: [],
            tl: [],
            raw: []
          },
          audio: "",
          quality: undefined
        };
      });
    }
    if (initPosition >= 0 && initPosition < list.length) {
      this._position = initPosition;
      this.setPlayingStatus(true);
    } else {
      this._position = -1;
    }
    this.updateOuter();
    return this.current();
  }

  addPlaylist(list: NeteaseTrack[] | PlayerTrackStatus[], source: Optional<number> = undefined) {
    const firstElement = list?.[0];
    if (!firstElement) return this.current();
    if ("source" in firstElement && firstElement.track) {
      // Player已经是TrackStatus类型
      if (source !== undefined) {
        // 需要替换source
        this._playlist.push(
          ...(list as PlayerTrackStatus[]).map((item) => {
            return {
              ...item,
              source: source as number | null
            };
          })
        );
      } else {
        this._playlist.push(...(list as PlayerTrackStatus[]));
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      this._playlist.push(
        ...(list as NeteaseTrack[]).map((track) => {
          return {
            source: source as number | null,
            track,
            lyric: {
              full: [],
              rm: [],
              tl: [],
              raw: []
            },
            audio: "",
            quality: undefined
          } satisfies PlayerTrackStatus;
        })
      );
    }
    this.updateOuter();
    return this.current();
  }

  clearPlaylist() {
    this._playlist = [];
    this._position = -1;
    this.updateOuter();
    return this.current();
  }

  removeTrack(position: number) {
    // 检查位置合法性
    if (position >= 0 && position < this._playlist.length) {
      this._playlist.splice(position, 1);
      // 调整当前位置
      if (position > this._position) {
        // 删除位置在当前播放位置之后，不调整
      } else if (position < this._position) {
        // 删除位置在当前播放位置之前，当前位置-1
        this._position -= 1;
      } else {
        // 删除位置就是当前播放位置，当前位置不变，但需要检查是否合法
        if (this._position >= this._playlist.length) {
          this._position = this._playlist.length - 1;
        }
      }
    }
    this.updateOuter();
    return this.current();
  }

  addTrack(
    track: NeteaseTrack | PlayerTrackStatus,
    source: Optional<number> = undefined,
    position: "next" | "end" = "end"
  ) {
    let newTrack: PlayerTrackStatus;
    if ("source" in track && track.track) {
      // PlayerTrackStatus类型
      if (source !== undefined) {
        newTrack = {
          ...track,
          source
        };
      } else {
        newTrack = track as PlayerTrackStatus;
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      newTrack = {
        source,
        track: track as NeteaseTrack,
        lyric: {
          full: [],
          rm: [],
          tl: [],
          raw: []
        },
        audio: "",
        quality: undefined
      };
    }
    if (position === "end") {
      this._playlist.push(newTrack);
    } else {
      this._playlist.splice(this._position + 1, 0, newTrack);
    }
    this.updateOuter();
    return this.current();
  }

  position() {
    return this._position;
  }

  setPosition(pos: number) {
    if (pos < 0 || pos >= this._playlist.length) return this.current();
    this._position = pos;
    this.updateOuter();
    return this.current();
  }

  isSamePlaylist(list: NeteaseTrack[] | PlayerTrackStatus[], source?: Optional<number>) {
    if (!list || list.length !== this._playlist.length) return false;
    for (let i = 0; i < list.length; i++) {
      const incoming = list[i]!;
      const existing = this._playlist[i];
      const incomingId = "track" in incoming ? incoming.track.id : incoming.id;
      const incomingSource = "source" in incoming ? incoming.source : (source ?? null);
      if (!existing || existing.track.id !== incomingId || existing.source !== incomingSource) {
        return false;
      }
    }
    return true;
  }

  current(autoplay: boolean = false) {
    if (!this.canPlay()) return null;
    if (this._position === -1) {
      if (autoplay) {
        this._position = 0;
      } else {
        return null;
      }
    }
    return this._playlist[this._position] || null;
  }

  next(force: boolean = true): Nullable<PlayerTrackStatus> {
    if (!this.canPlay()) return null;
    if (!force && this._repeat === "one") return this.current(false);
    let nextPos;
    if (this._shuffle) {
      // 随机播放
      nextPos = Math.floor(Math.random() * this._playlist.length);
    } else {
      if (this._position + 1 >= this._playlist.length) {
        if (this._repeat === "all" && this._playlist.length >= 1) {
          // 列表循环
          nextPos = 0;
        } else {
          // 播放结束
          nextPos = -1;
        }
      } else {
        // 顺序播放
        nextPos = this._position + 1;
      }
    }
    if (this._playlist[nextPos]?.track?.playable === false) {
      return this.next(force);
    }
    this._position = nextPos;
    this.setPlayingStatus(true);
    this.updateOuter();
    return this.current(false);
  }

  peek() {
    return this._playlist[this._position + 1] || null;
  }

  last(force: boolean = true): Nullable<PlayerTrackStatus> {
    if (!this.canPlay()) return null;
    if (!force && this._repeat === "one") return this.current(false);
    let lastPos;
    if (this._shuffle) {
      // 随机播放
      lastPos = Math.floor(Math.random() * this._playlist.length);
    } else {
      if (this._position - 1 < 0) {
        if (this._repeat === "all" && this._playlist.length >= 1) {
          // 列表循环
          lastPos = this._playlist.length - 1;
        } else {
          // 播放结束
          lastPos = -1;
        }
      } else {
        // 顺序播放
        lastPos = this._position - 1;
      }
    }
    if (this._playlist[lastPos]?.track?.playable === false) {
      return this.last(force);
    }
    this._position = lastPos;
    this.setPlayingStatus(true);
    this.updateOuter();
    return this.current(false);
  }

  canPlay() {
    return (
      (this._position === -1 && this._playlist.length > 0) ||
      (this._position >= 0 && this._position < this._playlist.length)
    );
  }

  get repeat() {
    return this._repeat;
  }

  set repeat(status: "off" | "one" | "all") {
    this._repeat = status;
    startTransition(() => {
      this._outerStatusUpdater?.((draft) => {
        draft.repeat = status;
      });
    });
  }

  get shuffle() {
    return this._shuffle;
  }

  set shuffle(status: boolean) {
    this._shuffle = status;
    startTransition(() => {
      this._outerStatusUpdater?.((draft) => {
        draft.shuffle = status;
      });
    });
  }

  get count() {
    return this._playlist.length;
  }

  get playlist() {
    return this._playlist;
  }
})();
