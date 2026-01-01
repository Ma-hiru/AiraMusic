import { getPlayerStoreSnapshot, PlayerFSMEvent } from "@mahiru/ui/store/player";
import { startTransition } from "react";

export class PlayerCore {
  position = -1;
  playlist: PlayerTrackStatus[] = [];
  get repeat() {
    return getPlayerStoreSnapshot().PlayerStatus.repeat;
  }
  set repeat(status: "off" | "one" | "all") {
    startTransition(() => {
      const { SetPlayerStatus } = getPlayerStoreSnapshot();
      SetPlayerStatus((draft) => {
        if (draft.repeat !== status) {
          draft.repeat = status;
        }
      });
    });
  }
  get shuffle() {
    return getPlayerStoreSnapshot().PlayerStatus.shuffle;
  }
  set shuffle(status: boolean) {
    startTransition(() => {
      const { SetPlayerStatus } = getPlayerStoreSnapshot();
      SetPlayerStatus((draft) => {
        if (draft.shuffle !== status) {
          draft.shuffle = status;
        }
      });
    });
  }
  get play() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.play;
  }
  get pause() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.pause;
  }
  get mute() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.mute;
  }
  get upVolume() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.upVolume;
  }
  get downVolume() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.downVolume;
  }
  get changeCurrentTime() {
    return getPlayerStoreSnapshot().AudioControlGetter()?.changeCurrentTime;
  }

  private updateOuter() {
    startTransition(() => {
      const current = this.current();
      const { SetPlayerTrackStatus, SetPlayerStatus } = getPlayerStoreSnapshot();
      SetPlayerTrackStatus((draft) => {
        if (draft && draft.track.id === current?.track.id) return;
        return current;
      });
      SetPlayerStatus((draft) => {
        draft.playerList = this.playlist;
        draft.position = this.position;
      });
    });
  }

  private triggerFSMEvent(event: PlayerFSMEvent) {
    const { TriggerPlayerFSMEvent, SetPlayingRequest } = getPlayerStoreSnapshot();
    // 当触发 requestRestart 时，表示要切换歌曲并播放，需要同时设置播放请求
    if (event === "requestRestart") {
      SetPlayingRequest(true);
    }
    TriggerPlayerFSMEvent(event);
  }

  Sync() {
    const { PlayerStatus } = getPlayerStoreSnapshot();
    this.playlist = PlayerStatus.playerList;
    this.position = PlayerStatus.position;
    this.updateOuter();
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
        this.playlist = (list as PlayerTrackStatus[]).map((item) => {
          return {
            ...item,
            source: source as number | null
          };
        });
      } else {
        this.playlist = list as PlayerTrackStatus[];
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      this.playlist = (list as NeteaseTrack[]).map((track) => {
        return {
          source: source as Nullable<number>,
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
      this.position = initPosition;
      this.triggerFSMEvent("requestRestart");
    } else {
      this.position = -1;
      this.triggerFSMEvent("playingEnd");
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
        this.playlist.push(
          ...(list as PlayerTrackStatus[]).map((item) => {
            return {
              ...item,
              source: source as number | null
            };
          })
        );
      } else {
        this.playlist.push(...(list as PlayerTrackStatus[]));
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      this.playlist.push(
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
    this.playlist = [];
    this.position = -1;
    this.updateOuter();
    this.triggerFSMEvent("playingEnd");
    return this.current();
  }

  removeTrack(position: number) {
    // 检查位置合法性
    if (position >= 0 && position < this.playlist.length) {
      this.playlist.splice(position, 1);
      // 调整当前位置
      if (position > this.position) {
        // 删除位置在当前播放位置之后，不调整
      } else if (position < this.position) {
        // 删除位置在当前播放位置之前，当前位置-1
        this.position -= 1;
      } else {
        // 删除位置就是当前播放位置，当前位置不变，但需要检查是否合法
        if (this.position >= this.playlist.length) {
          this.position = this.playlist.length - 1;
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

    let exist: Undefinable<PlayerTrackStatus>;
    let existPos = -1;
    for (const trackStatus of this.playlist) {
      existPos++;
      if (trackStatus.track.id === newTrack.track.id) {
        exist = trackStatus;
        break;
      }
    }

    if (!exist) {
      // 如果原有播放列表没有该歌曲
      if (position === "end") {
        this.playlist.push(newTrack);
      } else {
        this.playlist.splice(this.position + 1, 0, newTrack);
      }
    } else {
      // 如果有，则改变位置
      if (existPos !== this.position) {
        // 如果现有位置不是播放位置
        this.playlist.splice(existPos, 1);
        this.playlist.splice(this.position + 1, 0, exist);
      } else {
        // 如果现有位置是播放位置
        // TODO: 应不应该忽略？
      }
    }
    this.updateOuter();
    return this.current(false);
  }

  setPlayerPosition(pos: number) {
    if (pos < 0 || pos >= this.playlist.length) return this.current();
    if (this.position !== pos) {
      this.position = pos;
      this.updateOuter();
      this.triggerFSMEvent("requestRestart");
    }
    return this.current();
  }

  isSamePlaylist(list: NeteaseTrack[] | PlayerTrackStatus[], source?: Optional<number>) {
    if (!list || list.length !== this.playlist.length) return false;
    for (let i = 0; i < list.length; i++) {
      const incoming = list[i]!;
      const existing = this.playlist[i];
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
    if (this.position === -1) {
      if (autoplay) this.position = 0;
      else return null;
    }
    return this.playlist[this.position] || null;
  }

  next(force: boolean = true): Nullable<PlayerTrackStatus> {
    if (!this.canPlay()) {
      this.triggerFSMEvent("playingEnd");
      return null;
    }
    if (!force && this.repeat === "one") {
      this.triggerFSMEvent("requestRestart");
      return this.current(false);
    }
    let nextPos;
    if (this.shuffle) {
      // 随机播放
      nextPos = Math.floor(Math.random() * this.playlist.length);
    } else {
      if (this.position + 1 >= this.playlist.length) {
        if (this.repeat === "all" && this.playlist.length >= 1) {
          // 列表循环
          nextPos = 0;
        } else {
          // 播放结束
          nextPos = -1;
        }
      } else {
        // 顺序播放
        nextPos = this.position + 1;
      }
    }
    this.position = nextPos;
    if (this.current(false)?.track?.playable === false) {
      return this.next(force);
    }
    this.updateOuter();
    this.triggerFSMEvent("requestRestart");
    return this.current(false);
  }

  peek() {
    const nextPos = (this.position + 1) % this.playlist.length;
    return this.playlist[nextPos] || null;
  }

  last(force: boolean = true): Nullable<PlayerTrackStatus> {
    if (!this.canPlay()) {
      this.triggerFSMEvent("playingEnd");
      return null;
    }
    if (!force && this.repeat === "one") {
      this.triggerFSMEvent("requestRestart");
      return this.current(false);
    }
    let lastPos;
    if (this.shuffle) {
      // 随机播放
      lastPos = Math.floor(Math.random() * this.playlist.length);
    } else {
      if (this.position - 1 < 0) {
        if (this.repeat === "all" && this.playlist.length >= 1) {
          // 列表循环
          lastPos = this.playlist.length - 1;
        } else {
          // 播放结束
          lastPos = -1;
        }
      } else {
        // 顺序播放
        lastPos = this.position - 1;
      }
    }
    this.position = lastPos;
    if (this.playlist[lastPos]?.track?.playable === false) {
      return this.last(force);
    }
    this.updateOuter();
    this.triggerFSMEvent("requestRestart");
    return this.current(false);
  }

  canPlay() {
    const position = this.position;
    const playlist = this.playlist;
    return (
      (position === -1 && playlist.length > 0) || (position >= 0 && position < playlist.length)
    );
  }
}
