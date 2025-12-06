import { ReactNode, useEffect } from "react";
import { PlayerCtx } from "./PlayerCtx";
import { useSong } from "@mahiru/ui/hook/useSong";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { Store } from "@mahiru/ui/store";
import { Log } from "@mahiru/ui/utils/dev";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const ctxValue = useSong();
  useEffect(() => {
    Log.trace("PlayerProvider", "ctx value change");
  }, [ctxValue]);
  const cachedAudio = useFileCache(ctxValue.info.audio, {
    id: "audio_" + ctxValue.info.id
  });
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        ref={ctxValue.audioRef}
        src={cachedAudio}
        preload="auto"
        onError={(err) => {
          const raw = ctxValue.info.audio;
          if (err.currentTarget.src === raw) return;
          Log.info("ui/player/PlayerProvider.tsx", "Audio load error, fallback to raw src");
          err.currentTarget.src = raw;
          void Store.remove("audio_" + ctxValue.info.id);
        }}
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
