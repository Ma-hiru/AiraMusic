import { ReactNode, useRef } from "react";
import { PlayerCtx } from "./PlayerCtx";
import { useImmer } from "use-immer";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const SongSourceInfo = useImmer({});
  const audioRef = useRef<HTMLAudioElement>(null);
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={audioRef}
        src={"/小さな恋のうた - 石見舞菜香.mp3"}
        preload="auto"
      />
      <PlayerCtx.Provider value={{}}>{children}</PlayerCtx.Provider>
    </>
  );
}
