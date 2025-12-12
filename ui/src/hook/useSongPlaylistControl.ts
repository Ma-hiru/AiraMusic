import { useEffect, useMemo } from "react";
import { Updater } from "use-immer";

export class PlaylistPlayerManager {
  private _position: number = -1;
  private _playlist: PlayerTrackStatus[] = [];
  private _shuffle: boolean = false;
  private _repeat: "off" | "one" | "all" = "off";
  private _outerTrackUpdater: Nullable<Updater<Nullable<PlayerTrackStatus>>> = null;
  private _outerStatusUpdater: Nullable<Updater<PlayerStatus>> = null;
  private _beforeTrackUpdate: Nullable<NormalFunc<[next: Nullable<PlayerTrackStatus>]>> = null;

  constructor() {
    this.loadFromZustand();
  }

  set beforeTrackUpdate(callback: NormalFunc<[next: Nullable<PlayerTrackStatus>]>) {
    this._beforeTrackUpdate = callback;
  }

  set outerTrackUpdater(updater: Updater<Nullable<PlayerTrackStatus>>) {
    this._outerTrackUpdater = updater;
  }

  set outerStatusUpdater(updater: Updater<PlayerStatus>) {
    this._outerStatusUpdater = updater;
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
          audio: ""
        };
      });
    }
    if (initPosition >= 0 && initPosition < list.length) {
      this._position = initPosition;
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
            audio: ""
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
        audio: ""
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

  updateOuter() {
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

  next(force: boolean = true) {
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
    this._position = nextPos;
    this.updateOuter();
    return this.current(false);
  }

  peek() {
    return this._playlist[this._position + 1] || null;
  }

  last(force: boolean = true) {
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
    this._position = lastPos;
    this.updateOuter();
    return this.current(false);
  }

  count() {
    return this._playlist.length;
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
    this._outerStatusUpdater?.((draft) => {
      draft.repeat = status;
    });
  }

  get shuffle() {
    return this._shuffle;
  }

  set shuffle(status: boolean) {
    this._shuffle = status;
    this._outerStatusUpdater?.((draft) => {
      draft.shuffle = status;
    });
  }

  get playlist() {
    return this._playlist;
  }
}

const playlistManager = new PlaylistPlayerManager();

export function useSongPlaylistControl(props: {
  outerTrackUpdater: Updater<Nullable<PlayerTrackStatus>>;
  outerStatusUpdater: Updater<PlayerStatus>;
  beforeTrackUpdate: NormalFunc<[next: Nullable<PlayerTrackStatus>]>;
}) {
  const { outerStatusUpdater, outerTrackUpdater, beforeTrackUpdate } = props;
  useEffect(() => {
    playlistManager.beforeTrackUpdate = beforeTrackUpdate;
    playlistManager.outerTrackUpdater = outerTrackUpdater;
    playlistManager.outerStatusUpdater = outerStatusUpdater;
  }, [beforeTrackUpdate, outerStatusUpdater, outerTrackUpdater]);
  useEffect(() => {
    playlistManager.updateOuter();
  }, []);
  return useMemo(
    () => ({
      nextTrack: playlistManager.next.bind(playlistManager),
      lastTrack: playlistManager.last.bind(playlistManager),
      addTrack: playlistManager.addTrack.bind(playlistManager),
      addPlaylist: playlistManager.addPlaylist.bind(playlistManager),
      replacePlaylist: playlistManager.replacePlaylist.bind(playlistManager),
      removeTrack: playlistManager.removeTrack.bind(playlistManager),
      clearPlaylist: playlistManager.clearPlaylist.bind(playlistManager),
      setRepeat: (status: "all" | "off" | "one") => (playlistManager.repeat = status),
      setShuffle: (staus: boolean) => (playlistManager.shuffle = staus),
      count: playlistManager.count.bind(playlistManager),
      position: playlistManager.position.bind(playlistManager),
      setPosition: playlistManager.setPosition.bind(playlistManager),
      isSamePlaylist: playlistManager.isSamePlaylist.bind(playlistManager),
      current: playlistManager.current.bind(playlistManager),
      canPlay: playlistManager.canPlay.bind(playlistManager),
      playlistManager
    }),
    []
  );
}
