import { ReactNode, SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { usePlayerBind } from "@mahiru/ui/hook/usePlayerBind";
import { Log } from "@mahiru/ui/utils/dev";
import { useWindowTitle } from "@mahiru/ui/hook/useWindowTitle";
import { Track } from "@mahiru/ui/utils/track";
import { PlayerCtx } from "@mahiru/ui/ctx/PlayerCtx";
import { usePlayerStatus } from "@mahiru/ui/store";

export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxValue = usePlayerBind(audioRef);
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const { updateWindowTitle, defaultTitle } = useWindowTitle();
  useEffect(() => {
    const title = trackStatus?.track.name;
    const artist = trackStatus?.track.ar;
    if (title && artist) {
      updateWindowTitle(`${title} - ${artist.map((ar) => ar.name).join("&")}`);
    } else {
      updateWindowTitle(defaultTitle);
    }
  }, [defaultTitle, trackStatus?.track.ar, trackStatus?.track.name, updateWindowTitle]);
  useEffect(() => {
    Log.trace("PlayerProvider", "ctx value change");
  }, [ctxValue]);

  const onError = useCallback(
    (err: SyntheticEvent<HTMLAudioElement>) => {
      const raw = trackStatus?.meta?.[0]?.url;
      if (raw) {
        if (err.currentTarget.src !== raw) {
          Log.info("ctx/PlayerProvider.tsx", "cache audio load error, fallback to raw src");
          err.currentTarget.src = raw;
          const id = trackStatus?.track.id;
          if (id) {
            Track.removeCache(id);
          }
        } else {
          Log.error("ctx/PlayerProvider.tsx", "audio playback error", err);
          // TODO: 播放错误，可能是403或网络错误，403应该重新登录或刷新缓存，网络错误则跳过当前歌曲
          ctxValue.Player.next(true);
        }
      }
    },
    [ctxValue.Player, trackStatus?.meta, trackStatus?.track.id]
  );
  return (
    <>
      <audio
        className="w-0 h-0 opacity-0"
        controls={false}
        autoPlay={false}
        ref={audioRef}
        src={trackStatus?.audio || undefined}
        preload="auto"
        onError={onError}
      />
      <PlayerCtx.Provider value={ctxValue}>{children}</PlayerCtx.Provider>
    </>
  );
}
