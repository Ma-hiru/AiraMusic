import { createContext, RefObject, useContext } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { EqError } from "@mahiru/ui/utils/err";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";

export type PlayerCtxType = {
  lyricLines: LyricLine[];
  audioRef: RefObject<HTMLAudioElement | null>;
  playList: PlayerCtxType["info"][];
  replacePlayList: (playList: PlayerCtxType["info"][], currentIndex: number) => void;
  info: {
    id: number;
    title: string;
    artist: NeteaseTrack["ar"];
    album: NeteaseTrack["al"];
    cover: string;
    audio: string;
  };
  currentIndex: number;
  setInfo: (info: PlayerCtxType["info"]) => void;
  setPlayList: (list: PlayerCtxType["info"][]) => void;
  setCurrentIndex: (index: number) => void;
  play: () => void;
  mute: () => void;
  upVolume: (gap?: number) => void;
  downVolume: (gap?: number) => void;
  isPlaying: boolean;
  addTrackToList: (newTrack: PlayerCtxType["info"]) => void;
  addAndPlayTrack: (newTrack: PlayerCtxType["info"]) => void;
  removeTrackInList: (trackId: number) => void;
  nextTrack: () => void;
  lastTrack: () => void;
  clearPlayList: () => void;
};

function blankFunc() {}

export const PlayerCtx = createContext<PlayerCtxType>({
  lyricLines: [],
  audioRef: { current: null },
  playList: [],
  info: {
    id: 0,
    title: "",
    artist: [] as NeteaseTrack["ar"],
    album: {
      id: 0,
      name: "",
      pic: 0,
      pic_str: "",
      picUrl: "",
      tns: []
    } as NeteaseTrack["al"],
    cover: "",
    audio: ""
  },
  currentIndex: 0,
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
  replacePlayList: blankFunc,
  isPlaying: false
});

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
