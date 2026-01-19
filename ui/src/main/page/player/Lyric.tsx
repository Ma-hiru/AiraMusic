import {
  FC,
  memo,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useDevice } from "@mahiru/ui/public/hooks/useDevice";
import { NeteaseLyric } from "@mahiru/ui/public/entry/lyric";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import { clamp } from "lodash-es";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";

import LyricPlayer, { LyricPlayerRef } from "@mahiru/ui/public/components/player/LyricPlayer";

const Lyric: FC<object> = () => {
  const {
    PlayerStatus,
    PlayerFSMStatus,
    PlayerTrackStatus,
    PlayerProgressGetter,
    PlayerInitialized,
    PlayerCoreGetter
  } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerStatus",
    "PlayerProgressGetter",
    "PlayerFSMStatus",
    "PlayerInitialized",
    "PlayerCoreGetter"
  ]);
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  const { gpu } = useDevice();
  const audio = PlayerCoreGetter().audio;
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const lastTrackID = useRef(PlayerTrackStatus?.track.id);

  const lines = useMemo(
    () => NeteaseLyric.chooseLyric(PlayerTrackStatus?.lyric, PlayerStatus.lyricVersion, true),
    [PlayerStatus.lyricVersion, PlayerTrackStatus?.lyric]
  );

  // 切换时，先清空一次，释放内存
  useEffect(() => {
    const currentID = PlayerTrackStatus?.track.id;
    if (!currentID) return;
    if (currentID !== lastTrackID.current) {
      lastTrackID.current = currentID;
      startTransition(() => {
        setLyricLines([]);
      });
    } else {
      requestIdleCallback(
        () => {
          setLyricLines(lines);
        },
        { timeout: 2000 }
      );
    }
  }, [PlayerTrackStatus?.track.id, lines]);

  const onLyricLineClick = useCallback(
    (e: LyricLineMouseEvent) => {
      const clickTimeMs = e.line.getLine().startTime;
      const duration = PlayerProgressGetter().duration;
      if (Number.isFinite(clickTimeMs) && Number.isFinite(duration)) {
        audio.currentTime = clamp(clickTimeMs / 1000, 0, duration);
        lyricPlayerRef.current?.lyricPlayer?.resetScroll();
        lyricPlayerRef.current?.lyricPlayer?.calcLayout();
      }
    },
    [PlayerProgressGetter, audio]
  );

  useEffect(() => {
    let lastTime = -1;
    let rafId: Nullable<number> = null;
    let isRunning = false;

    const onFrame = (time: number) => {
      if (!isRunning || !audio || audio.paused) {
        rafId = null;
        return;
      }
      // 如果lastTime === -1 说明是第一次记录时间
      if (lastTime === -1) lastTime = time;
      lyricPlayerRef.current?.lyricPlayer?.update(time - lastTime);
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(audio.currentTime * 1000);

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
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(audio.currentTime * 1000);
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
    };

    audio.addEventListener("play", startLoop, { passive: true });
    audio.addEventListener("pause", stopLoop, { passive: true });
    audio.addEventListener("loadstart", loadstart, { passive: true });
    return () => {
      stopLoop();
      audio.removeEventListener("play", startLoop);
      audio.removeEventListener("pause", stopLoop);
      audio.removeEventListener("loadstart", loadstart);
    };
  }, [audio]);

  useEffect(() => {
    if (PlayerInitialized && audio) {
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(audio.currentTime * 1000);
      lyricPlayerRef.current?.lyricPlayer?.resetScroll();
      lyricPlayerRef.current?.lyricPlayer?.calcLayout();
    }
  }, [PlayerInitialized, audio]);

  return (
    <div className="absolute top-0 left-[48%] w-1/2 h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter text-lg transition-normal ease-in-out">
      <LyricPlayer
        disabled={true}
        playing={PlayerFSMStatus === PlayerFSMStatusEnum.playing && PlayerVisible}
        className="w-full h-full"
        ref={lyricPlayerRef}
        alignPosition={0.5}
        alignAnchor="center"
        lyricLines={lines}
        enableScale={gpu.dedicated}
        enableSpring={gpu.dedicated}
        onLyricLineClick={onLyricLineClick}
      />
    </div>
  );
};
export default memo(Lyric);
