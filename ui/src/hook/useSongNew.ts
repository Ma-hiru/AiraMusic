import { RefObject, useCallback, useLayoutEffect, useRef } from "react";
import { LyricVersionType } from "@mahiru/ui/ctx/PlayerCtx";
import { FullVersionLyricLine } from "@mahiru/ui/utils/lyric";
import { Updater, useImmer } from "use-immer";
import { useLock } from "@mahiru/ui/hook/useLock";
import { useSongResource } from "@mahiru/ui/hook/useSongResource";
import { scrobble as requestScrobble } from "@mahiru/ui/api/track";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { useMediaSession } from "@mahiru/ui/hook/useMediaSession";
import { useKeyboardShortcut } from "@mahiru/ui/hook/useKeyboardShortcut";

export type TrackInfo = {
  source: Nullable<number>;
  track: NeteaseTrack;
};

export type TrackSource = {
  lyric: {
    version: LyricVersionType;
    data: FullVersionLyricLine;
  };
  audio: string;
  meta?: NeteaseSongUrlItem[];
};

export type TrackStatus = TrackInfo & TrackSource;

export type PlayerStatus = {
  playing: boolean;
  volume: number;
  volumeBeforeMute: number;
  repeat: "off" | "one" | "all";
  shuffle: boolean;
  position: number;
  lyricPreference: LyricVersionType | null;
};

export type PlayerProgress = {
  currentTime: number;
  duration: number;
  buffered: number;
  size: number;
};

class PlaylistManager {
  private _position: number = -1;
  private _playlist: TrackStatus[] = [];
  private _shuffle: boolean = false;
  private _repeat: "off" | "one" | "all" = "off";
  private _outerTrackUpdater: Nullable<Updater<Nullable<TrackStatus>>> = null;
  private _outerStatusUpdater: Nullable<Updater<PlayerStatus>> = null;

  set outerTrackUpdater(updater: Updater<Nullable<TrackStatus>>) {
    this._outerTrackUpdater = updater;
  }
  set outerStatusUpdater(updater: Updater<PlayerStatus>) {
    this._outerStatusUpdater = updater;
  }

  replacePlaylist(
    list: NeteaseTrack[] | TrackStatus[],
    source: Optional<number> = undefined,
    initPosition: number = -1
  ) {
    const firstElement = list?.[0];
    if (!firstElement) return this.current();
    if ("source" in firstElement && firstElement.track) {
      // 已经是TrackStatus类型
      if (source !== undefined) {
        // 需要替换source
        this._playlist = (list as TrackStatus[]).map((item) => {
          return {
            ...item,
            source: source as number | null
          };
        });
      } else {
        this._playlist = list as TrackStatus[];
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      this._playlist = (list as NeteaseTrack[]).map((track) => {
        return {
          source: source as number | null,
          track,
          lyric: {
            version: "raw",
            data: {
              full: [],
              rm: [],
              tl: [],
              raw: []
            }
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

  addPlaylist(list: NeteaseTrack[] | TrackStatus[], source: Optional<number> = undefined) {
    const firstElement = list?.[0];
    if (!firstElement) return this.current();
    if ("source" in firstElement && firstElement.track) {
      // 已经是TrackStatus类型
      if (source !== undefined) {
        // 需要替换source
        this._playlist.push(
          ...(list as TrackStatus[]).map((item) => {
            return {
              ...item,
              source: source as number | null
            };
          })
        );
      } else {
        this._playlist.push(...(list as TrackStatus[]));
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
              version: "raw",
              data: {
                full: [],
                rm: [],
                tl: [],
                raw: []
              }
            },
            audio: ""
          } satisfies TrackStatus;
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
    track: NeteaseTrack | TrackStatus,
    source: Optional<number> = undefined,
    position: "next" | "end" = "end"
  ) {
    let newTrack: TrackStatus;
    if ("source" in track && track.track) {
      // TrackStatus类型
      if (source !== undefined) {
        newTrack = {
          ...track,
          source
        };
      } else {
        newTrack = track as TrackStatus;
      }
    } else {
      // NeteaseTrack类型
      source ||= null;
      newTrack = {
        source,
        track: track as NeteaseTrack,
        lyric: {
          version: "raw",
          data: {
            full: [],
            rm: [],
            tl: [],
            raw: []
          }
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

  updateOuter() {
    const current = this.current();
    this._outerTrackUpdater?.((draft) => {
      if (draft && draft.track.id === current?.track.id) return;
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

const playlistManager = new PlaylistManager();

export function useSong(audioRef: RefObject<Nullable<HTMLAudioElement>>) {
  /**                        状态管理                         */
  const playerProgress = useRef<PlayerProgress>({
    buffered: 0,
    currentTime: 0,
    duration: 0,
    size: 0
  });
  const [trackStatus, setTrackStatus] = useImmer<Nullable<TrackStatus>>(null);
  const [playerStatus, setPlayerStatus] = useImmer<PlayerStatus>({
    playing: false,
    position: 0,
    repeat: playlistManager.repeat,
    shuffle: playlistManager.shuffle,
    volume: 0.5,
    volumeBeforeMute: 0.5,
    lyricPreference: null
  });
  playlistManager.outerTrackUpdater = setTrackStatus;
  playlistManager.outerStatusUpdater = setPlayerStatus;
  /**                        资源管理                         */
  const transitionLock = useLock();
  const resourceControl = useSongResource({
    playerProgress,
    setTrackStatus
  });
  /**                        播放控制                         */
  const play = useCallback(() => {
    const audio = audioRef.current;
    audio && (audio.paused ? audio.play() : audio.pause());
  }, [audioRef]);
  const mute = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
      if (audio.muted) {
        setPlayerStatus((draft) => {
          draft.volumeBeforeMute = audio.volume;
        });
        audio.volume = 0;
      } else {
        audio.volume = playerStatus.volumeBeforeMute;
      }
    }
  }, [audioRef, playerStatus.volumeBeforeMute, setPlayerStatus]);
  const upVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current;
      if (audio) {
        gap ||= 0.2;
        audio.volume = Math.min(1, audio.volume + gap);
        audio.volume > 0 && audio.muted && (audio.muted = false);
      }
    },
    [audioRef]
  );
  const downVolume = useCallback(
    (gap?: number) => {
      const audio = audioRef.current;
      if (audio) {
        gap ||= 0.2;
        audio.volume = Math.max(0, audio.volume - gap);
        audio.volume > 0 && audio.muted && (audio.muted = false);
      }
    },
    [audioRef]
  );
  const changeCurrentTime = useCallback(
    (targetTime: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(targetTime)) return;
      const duration = Number.isFinite(audio.duration)
        ? audio.duration
        : playerProgress.current.duration || 0;
      // 确保跳转时间在合法范围内 0 ~ duration 之间
      const clamped = Math.max(0, Math.min(duration > 0 ? duration : targetTime, targetTime));
      try {
        if (typeof audio.fastSeek === "function") {
          audio.fastSeek(clamped);
        } else {
          audio.currentTime = clamped;
        }
      } catch {
        audio.currentTime = clamped;
      }
    },
    [audioRef]
  );
  const scrobble = useCallback(() => {
    const source = trackStatus?.source || trackStatus?.track?.al?.id;
    source &&
      requestScrobble({
        id: trackStatus.track.id,
        sourceid: source,
        time: Math.floor(playerProgress.current.currentTime)
      });
  }, [trackStatus?.source, trackStatus?.track?.al?.id, trackStatus?.track.id]);
  /**                        状态变化                         */
  useLayoutEffect(() => {
    const current = trackStatus;
    const peak = playlistManager.peek();
    if (current) {
      void resourceControl.loadAudioSource(current.track.id);
      resourceControl.schedulePreloadNextTrack(current, peak);
    }
    return resourceControl.cancelScheduledPreload;
  }, [resourceControl, trackStatus]);
  useLayoutEffect(() => {
    const audio = audioRef.current;
    if (!audio || !trackStatus || !trackStatus.audio) return;
    audio.src = trackStatus.audio;
    const handleCanPlay = () => {
      audio.play().catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            message: "play() failed after canplay",
            label: "ui/ctx/PlayerProvider:canPlay"
          })
        );
      });
    };
    audio.addEventListener("canplay", handleCanPlay);
    audio.load();
    return () => {
      audio.removeEventListener("canplay", handleCanPlay);
    };
  }, [audioRef, trackStatus]);
  /**                    Media Session API                 */
  useMediaSession({
    info,
    nextTrack: audioControl.nextTrack,
    lastTrack: audioControl.lastTrack,
    play: audioControl.play
  });
  /**                        快捷键                         */
  useKeyboardShortcut([
    {
      key: " ",
      description: "播放/暂停",
      callback: play
    },
    {
      key: "ArrowRight",
      modifiers: ["alt"],
      description: "下一首",
      callback: () => playlistManager.next(true)
    },
    {
      key: "ArrowLeft",
      modifiers: ["alt"],
      description: "上一首",
      callback: () => playlistManager.last(true)
    },
    {
      key: "ArrowUp",
      description: "增加音量",
      callback: () => upVolume(0.1)
    },
    {
      key: "ArrowDown",
      description: "减少音量",
      callback: () => downVolume(0.1)
    }
  ]);
}
