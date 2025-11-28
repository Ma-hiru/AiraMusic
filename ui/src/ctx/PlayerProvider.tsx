import { ReactNode, useMemo } from "react";
import { PlayerCtx, PlayerCtxType } from "./PlayerCtx";
import { useSong } from "@mahiru/ui/hook/useSong";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { Store } from "@mahiru/ui/store";
import { Log } from "@mahiru/ui/utils/dev";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const props = useSong();
  const ctxValue = useMemo<PlayerCtxType>(() => props, [props]);
  const cachedAudio = useFileCache(props.info.audio, {
    id: "audio_" + props.info.id
  });
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={props.audioRef}
        src={cachedAudio}
        preload="auto"
        onError={(err) => {
          const raw = props.info.audio;
          if (err.currentTarget.src === raw) return;
          Log.info("ui/player/PlayerProvider.tsx", "Audio load error, fallback to raw src");
          err.currentTarget.src = raw;
          void Store.remove("audio_" + props.info.id);
        }}
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
