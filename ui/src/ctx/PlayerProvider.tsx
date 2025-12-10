import { ReactNode, SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { useSong } from "@mahiru/ui/hook/useSong";
import { Log } from "@mahiru/ui/utils/dev";
import { useWindowTitle } from "@mahiru/ui/hook/useWindowTitle";
import { Track } from "@mahiru/ui/utils/track";
import { PlayerCtx } from "@mahiru/ui/ctx/PlayerCtx";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxValue = useSong(audioRef);

  const { updateWindowTitle, defaultTitle } = useWindowTitle();
  useEffect(() => {
    const title = ctxValue.trackStatus?.track.name;
    const artist = ctxValue.trackStatus?.track.ar;
    if (title && artist) {
      updateWindowTitle(`${title} - ${artist.map((ar) => ar.name).join("&")}`);
    } else {
      updateWindowTitle(defaultTitle);
    }
  }, [
    ctxValue.trackStatus?.track.ar,
    ctxValue.trackStatus?.track.name,
    defaultTitle,
    updateWindowTitle
  ]);
  useEffect(() => {
    Log.trace("PlayerProvider", "ctx value change");
  }, [ctxValue]);

  const onError = useCallback(
    (err: SyntheticEvent<HTMLAudioElement>) => {
      const raw = ctxValue.trackStatus?.audio;
      if (raw && err.currentTarget.src !== raw) {
        Log.info("ui/player/PlayerProvider.tsx", "Audio load error, fallback to raw src");
        err.currentTarget.src = raw;
        const id = ctxValue.trackStatus?.track.id;
        if (id) {
          Track.removeCache(id);
        }
      }
    },
    [ctxValue.trackStatus?.audio, ctxValue.trackStatus?.track.id]
  );
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        controls={false}
        autoPlay={false}
        ref={audioRef}
        src={ctxValue.trackStatus?.audio}
        preload="auto"
        onError={onError}
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
