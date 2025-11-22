import { ReactNode, useMemo } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { useSong } from "@mahiru/ui/hook/useSong";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const props = useSong();
  const ctxValue = useMemo<PlayerCtxType>(() => props, [props]);
  const cachedAudio = useFileCache(props.info.audio, props.info.id);
  return (
    <>
      <audio className="w-0 h-0 opacity-0" ref={props.audioRef} src={cachedAudio} />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
