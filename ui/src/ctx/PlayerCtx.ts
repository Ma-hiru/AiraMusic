import { createContext, RefObject, useContext } from "react";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { FullVersionLyricLine } from "@mahiru/ui/utils/lyric";

export interface PlayerTrackInfo {
  id: number;
  title: string;
  alias: string;
  tsTitle: string;
  artist: NeteaseTrack["ar"];
  album: Partial<NeteaseTrack["al"]>;
  cover: string;
  audio: string;
  sourceID?: number;
}

export interface PlayerCtxProgress {
  currentTime: number;
  duration: number;
  buffered: number;
  size: number;
}

export type LyricVersionType = "raw" | "full" | "tl" | "rm";

export interface PlayerCtxType {
  // states
  isPlaying: boolean;
  volume: number;
  info: PlayerTrackInfo;
  currentIndex: number;
  lyricLines: FullVersionLyricLine;
  playList: PlayerTrackInfo[];
  getProgress: NormalFunc<never[], PlayerCtxProgress>;
  lyricVersion: LyricVersionType;
  isShuffle: boolean;
  isRepeat: boolean;
  shuffle: NormalFunc<[enable?: boolean]>;
  repeat: NormalFunc<[enable?: boolean]>;
  // refs
  audioRef: RefObject<HTMLAudioElement | null>;
  // actions
  play: NormalFunc;
  mute: NormalFunc;
  nextTrack: NormalFunc;
  lastTrack: NormalFunc;
  clearPlayList: NormalFunc;
  replacePlayList: NormalFunc<[playList: PlayerTrackInfo[], currentIndex: number]>;
  setInfo: NormalFunc<[info: PlayerTrackInfo]>;
  setPlayList: NormalFunc<[list: PlayerTrackInfo[]]>;
  setCurrentIndex: NormalFunc<[index: number]>;
  setLyricVersion: NormalFunc<["raw" | "full" | "tl" | "rm"]>;
  upVolume: NormalFunc<[gap?: number]>;
  downVolume: NormalFunc<[gap?: number]>;
  addTrackToList: NormalFunc<[newTrack: PlayerTrackInfo]>;
  addAndPlayTrack: NormalFunc<[newTrack: PlayerTrackInfo]>;
  removeTrackInList: NormalFunc<[trackId: number]>;
  changeCurrentTime: NormalFunc<[time: number]>;
}

export const PlayerCtxDefault = {
  isPlaying: false,
  volume: 0.5,
  lyricLines: {
    full: [],
    raw: [],
    tl: [],
    rm: []
  },
  lyricVersion: "raw" as "raw" | "full" | "tl" | "rm",
  audioRef: { current: null },
  isShuffle: false,
  isRepeat: false,
  playList: [],
  info: {
    title: "",
    artist: [],
    album: {
      id: 0,
      name: "",
      pic: 0,
      pic_str: "",
      picUrl: "",
      tns: []
    },
    cover: "",
    audio: "",
    id: 0,
    alias: "",
    tsTitle: ""
  },
  currentIndex: 0,
  getProgress: () => ({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    size: 0
  }),
  setInfo: blankFunc,
  setPlayList: blankFunc,
  setLyricVersion: blankFunc,
  setCurrentIndex: blankFunc,
  play: blankFunc,
  mute: blankFunc,
  upVolume: blankFunc,
  downVolume: blankFunc,
  addTrackToList: blankFunc,
  removeTrackInList: blankFunc,
  nextTrack: blankFunc,
  lastTrack: blankFunc,
  addAndPlayTrack: blankFunc,
  clearPlayList: blankFunc,
  replacePlayList: blankFunc,
  changeCurrentTime: blankFunc,
  shuffle: blankFunc,
  repeat: blankFunc
};

export const PlayerCtx = createContext<PlayerCtxType>(PlayerCtxDefault);

export const usePlayer = () => {
  const ctxValue = useContext(PlayerCtx);
  if (!ctxValue) {
    throw new EqError({
      message: "usePlayer must be used within a PlayerProvider",
      label: "ui/PlayerCtx:usePlayer"
    });
  }
  return ctxValue;
};

function blankFunc() {
  Log.info("ui/PlayerCtx.ts", "called blank function");
}
