import { useSetAtom } from "jotai";
import { memo, useRef, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { Log } from "@/common/lib/log";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { NeteaseServicesLyric } from "@/common/netease/services";
import { useTailwindMediaQuery } from "@/common/hooks/use-tailwind-media-query";
import { usePlayerViewVisible } from "@/wins/main/hooks/use-player-view-visible";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import LyricComponent, { type LyricRef } from "@/common/components/display/lyric";

const Lyric: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const lyric = player.current.lyric;
  const trackId = player.current.track?.id;
  const [restoringTrackId, setRestoringTrackId] = useState<number>();
  const lyricRef = useRef<Nullable<LyricRef>>(null);
  const visible = usePlayerViewVisible("player");
  const { jumpArtistPage } = usePageJump();
  const settings = useSettings();
  const setPlayModal = useSetAtom(playModalAtom);
  const handleArtistClick = useCallback(
    (id: number) => {
      const navigation = jumpArtistPage(id);
      if (!settings.preference.defaultUseDisplayWindow) setPlayModal(false);
      return navigation;
    },
    [jumpArtistPage, settings.preference.defaultUseDisplayWindow, setPlayModal]
  );

  const handleWordClick = useCallback(
    (timeMS: number) => {
      player.audio.currentTime = timeMS / 1000;
      player.paused && player.audio.play();
    },
    [player]
  );

  const restoreOriginalLyric = useCallback(async () => {
    if (
      trackId === undefined ||
      player.current.track?.id !== trackId ||
      restoringTrackId === trackId
    )
      return;

    setRestoringTrackId(trackId);
    try {
      NeteaseServicesLyric.excludeExtraTTML(trackId);
      await player.reloadLyric();
    } catch (error) {
      AppToast.show({ text: "恢复原始歌词失败", type: "error" });
      Log.error(error);
    } finally {
      setRestoringTrackId((current) => (current === trackId ? undefined : current));
    }
  }, [player, restoringTrackId, trackId]);

  useEffect(() => {
    if (!visible) return;
    lyricRef.current?.setCurrentTime(player.audio.instance.currentTime * 1000);
    lyricRef.current?.update(0);
  }, [lyric, player, visible]);

  useEffect(() => {
    if (!visible) return;
    let lastTime = -1;
    let rafId: Nullable<number> = null;
    let isRunning = false;

    const onFrame = (time: number) => {
      if (!isRunning || player.audio.paused) {
        rafId = null;
        return;
      }
      // 如果lastTime === -1 说明是第一次记录时间
      if (lastTime === -1) lastTime = time;
      lyricRef.current?.update(time - lastTime);
      lyricRef.current?.setCurrentTime(player.audio.instance.currentTime * 1000);
      lastTime = time;
      rafId = requestAnimationFrame(onFrame);
    };
    const startLoop = () => {
      if (isRunning) return;
      isRunning = true;
      lastTime = -1;
      rafId = requestAnimationFrame(onFrame);
    };
    const stopLoop = () => {
      isRunning = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
    const loadstart = () => {
      lyricRef.current?.calcLayout();
    };

    !player.audio.paused && startLoop();
    player.audio.addEventListener("play", startLoop, { passive: true });
    player.audio.addEventListener("pause", stopLoop, { passive: true });
    player.audio.addEventListener("loadstart", loadstart, { passive: true });
    return () => {
      stopLoop();
      player.audio.removeEventListener("play", startLoop);
      player.audio.removeEventListener("pause", stopLoop);
      player.audio.removeEventListener("loadstart", loadstart);
    };
  }, [player, visible]);

  const { lg, md, sm, xl, "2xl": xxl } = useTailwindMediaQuery();
  const fontSize = useMemo(() => {
    if (xxl) return 32;
    if (xl) return 30;
    if (lg) return 28;
    if (md) return 25;
    if (sm) return 23;
  }, [lg, md, sm, xl, xxl]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-strict ">
      <LyricComponent
        ref={lyricRef}
        className="contain-strict"
        lyric={lyric}
        fontSize={fontSize}
        playing={visible && player.playing}
        rmActive={player.current?.rmActive}
        tlActive={player.current?.tlActive}
        noteActive={player.current?.noteActive}
        tlLanguages={player.activeTranslationLanguages}
        onWordClick={handleWordClick}
        onArtistClick={handleArtistClick}>
        {trackId !== undefined && lyric?.isLocalTTML && lyric.id === trackId && (
          <button
            className="mx-4 my-1 cursor-pointer text-sm text-ink/80 underline underline-offset-4 hover:text-ink disabled:cursor-wait disabled:opacity-60"
            type="button"
            disabled={restoringTrackId === trackId}
            onClick={restoreOriginalLyric}>
            {restoringTrackId === trackId ? "正在恢复…" : "恢复原始歌词"}
          </button>
        )}
      </LyricComponent>
    </div>
  );
};
export default memo(Lyric);
