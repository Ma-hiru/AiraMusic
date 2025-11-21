import { createContext, RefObject, useContext } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { EqError } from "@mahiru/ui/utils/err";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { Log } from "@mahiru/ui/utils/log";

export interface PlayerTrackInfo {
  id: number;
  title: string;
  artist: NeteaseTrack["ar"];
  album: NeteaseTrack["al"];
  cover: string;
  audio: string;
}

export interface PlayerCtxProgress {
  currentTime: number;
  duration: number;
  buffered: number;
}

export interface PlayerCtxType {
  // states
  isPlaying: boolean;
  info: PlayerTrackInfo;
  currentIndex: number;
  lyricLines: LyricLine[];
  playList: PlayerTrackInfo[];
  progress: NormalFunc<never[], PlayerCtxProgress>;
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
  upVolume: NormalFunc<[gap?: number]>;
  downVolume: NormalFunc<[gap?: number]>;
  addTrackToList: NormalFunc<[newTrack: PlayerTrackInfo]>;
  addAndPlayTrack: NormalFunc<[newTrack: PlayerTrackInfo]>;
  removeTrackInList: NormalFunc<[trackId: number]>;
}

export const PlayerCtxDefault = {
  isPlaying: false,
  lyricLines: [],
  audioRef: { current: null },
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
    id: 0
  },
  currentIndex: 0,
  progress: () => ({
    currentTime: 0,
    duration: 0,
    buffered: 0
  }),
  setInfo: blankFunc,
  setPlayList: blankFunc,
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
  replacePlayList: blankFunc
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
