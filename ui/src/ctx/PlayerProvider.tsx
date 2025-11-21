import { ReactNode, useMemo } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";
import { useSong } from "@mahiru/ui/hook/useSong";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const props = useSong();
  const ctxValue = useMemo<PlayerCtxType>(() => props, [props]);
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={props.audioRef}
        src={(wrapCacheUrl(props.info.audio) || null) as string}
        preload="auto"
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
