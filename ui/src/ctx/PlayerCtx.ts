import { createContext, RefObject, useContext } from "react";
import { LyricLine } from "@applemusic-like-lyrics/core";
import { EqError } from "@mahiru/ui/utils/err";

export type PlayerCtxType = {
  lyricLines: LyricLine[];
  audioRef: RefObject<HTMLAudioElement | null>;
  cover: string;
  play: () => void;
  mute: () => void;
  upVolume: (gap?: number) => void;
  downVolume: (gap?: number) => void;
};

export const PlayerCtx = createContext<PlayerCtxType>({
  lyricLines: [],
  audioRef: { current: null },
  cover: "",
  play: () => {},
  mute: () => {},
  upVolume: (_?: number) => {},
  downVolume: (_?: number) => {}
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
