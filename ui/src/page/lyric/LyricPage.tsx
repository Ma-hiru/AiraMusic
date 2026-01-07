import Control from "@mahiru/ui/page/lyric/Control";
import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import LyricPlayer, { LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { cx } from "@emotion/css";
import { WindowResize } from "@mahiru/ui/hook/useWindowResize";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { UI } from "@mahiru/ui/utils/ui";
import { NeteaseLyric } from "@mahiru/ui/utils/lyric";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";
import { useThemeSyncReceive } from "@mahiru/ui/hook/useThemeSyncReceive";
import { usePlayerProgressSyncReceive } from "@mahiru/ui/hook/usePlayerProgressSyncReceive";
import { usePlayerStatusSyncReceive } from "@mahiru/ui/hook/usePlayerStatusSyncReceive";
import { PlayerFSMStatusEnum } from "@mahiru/ui/store/player";
import { usePlayerTrackSyncReceive } from "@mahiru/ui/hook/usePlayerTrackSyncReceive";

const LyricPage: FC<object> = () => {
  const { stage } = useStage();
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const [showBg, setShowBg] = useState(false);
  const [lock, setLock] = useState(false);
  const [color, setColor] = useState(() => {
    return window.localStorage.getItem("lyricWindowColor") || undefined;
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (window.localStorage.getItem("lyricWindowFontSize") as FontSize) || "16px";
  });
  const showBgTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);

  const { themeSync } = useThemeSyncReceive();
  const { progressSync } = usePlayerProgressSyncReceive();
  const { playerStatusSync } = usePlayerStatusSyncReceive();
  const { trackSync } = usePlayerTrackSyncReceive();

  const getInfo = useRef({
    progressSync,
    playerStatusSync
  });
  getInfo.current.progressSync = progressSync;
  getInfo.current.playerStatusSync = playerStatusSync;

  // 歌词播放同步
  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;
    const onFrame = (time: number) => {
      const { playerStatusSync, progressSync } = getInfo.current;
      if (playerStatusSync?.fsmState !== PlayerFSMStatusEnum.playing) return;
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      lyricPlayerRef.current?.lyricPlayer?.update(delta);
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime((progressSync.currentTime * 1000) | 0);

      rafId = requestAnimationFrame(onFrame);
    };
    if (playerStatusSync?.fsmState === PlayerFSMStatusEnum.playing) {
      rafId = requestAnimationFrame(onFrame);
    }
    return () => cancelAnimationFrame(rafId);
  }, [playerStatusSync?.fsmState]);
  // 颜色变化
  useEffect(() => {
    if (color !== undefined) {
      UI.AMLyricColor = color;
      window.localStorage.setItem("lyricWindowColor", color);
    } else {
      UI.AMLyricColor = themeSync.mainColor || "#ffffff";
      window.localStorage.removeItem("lyricWindowColor");
    }
  }, [color, themeSync.mainColor]);
  // 字体大小变化
  useEffect(() => {
    UI.AMLyricFontSize = fontSize;
    window.localStorage.setItem("lyricWindowFontSize", fontSize);
  }, [fontSize]);

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (lock) return;
      if (showBg) {
        setShowBg(false);
        return;
      }
      setShowBg(true);
      showBgTimer.current && clearTimeout(showBgTimer.current);
      showBgTimer.current = setTimeout(() => {
        setShowBg(false);
      }, 2500);
    },
    [lock, showBg]
  );

  const handleMouseOver = useCallback(
    (e: ReactMouseEvent) => {
      if (lock) return;
      e.preventDefault();
      setShowBg(true);
      showBgTimer.current && clearTimeout(showBgTimer.current);
      showBgTimer.current = setTimeout(() => {
        setShowBg(false);
      }, 2500);
    },
    [lock]
  );

  // 初始显示背景
  useEffect(() => {
    setShowBg(true);
    showBgTimer.current && clearTimeout(showBgTimer.current);
    showBgTimer.current = setTimeout(() => {
      setShowBg(false);
    }, 2500);
  }, []);

  useEffect(() => {
    Renderer.event.loaded({ broadcast: true });
    Renderer.addMessageHandler("otherWindowClosed", "main", () => {
      Renderer.event.close({ broadcast: false });
    });
  }, []);

  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);
  const lastTrackID = useRef<number | null>(null);
  const lines = useMemo(
    () => NeteaseLyric.chooseLyric(trackSync?.lyric, playerStatusSync?.lyricVersion, false),
    [playerStatusSync?.lyricVersion, trackSync?.lyric]
  );

  useEffect(() => {
    const currentID = trackSync?.track.id;
    if (!currentID) return;
    if (currentID !== lastTrackID.current) {
      lastTrackID.current = currentID;
      setLyricLines([]);
    }
    startTransition(() => {
      setLyricLines(lines);
    });
  }, [lines, trackSync?.track.id]);

  return (
    <div className="w-screen h-screen overflow-hidden relative flex rounded-md flex-col-reverse">
      <div
        className={cx(
          "w-screen flex-1 relative overflow-hidden flex flex-col justify-center items-center ease-in-out transition-all duration-300",
          showBg && "bg-black/10 rounded-lg",
          lock && "bg-transparent"
        )}
        onClick={handleClick}
        onMouseOver={handleMouseOver}>
        <div
          className={cx(
            "w-full h-full overflow-hidden contain-[paint_layout] mix-blend-plus-lighter transition-normal ease-in-out text-center",
            lock && "pointer-events-none"
          )}>
          {stage >= Stage.Finally && (
            <LyricPlayer
              ref={lyricPlayerRef}
              playing={playerStatusSync?.fsmState === PlayerFSMStatusEnum.playing}
              className="w-full h-full"
              alignAnchor="center"
              hidePassedLines
              lyricLines={lyricLines}
              enableScale={false}
              enableSpring={false}
            />
          )}
        </div>
      </div>
      {stage >= Stage.First && (
        <Control
          playerStatusSync={playerStatusSync}
          trackSync={trackSync}
          themeSync={themeSync}
          currentTime={progressSync.currentTime}
          duration={progressSync.duration}
          color={color}
          setColor={setColor}
          showBg={showBg}
          setShowBg={setShowBg}
          lock={lock}
          setLock={setLock}
          fontSize={fontSize}
          setFontSize={setFontSize}
        />
      )}
      {stage >= Stage.Finally && <WindowResize disable={lock || !showBg} showArea={false} />}
    </div>
  );
};
export default memo(LyricPage);

type FontSize = `${number}px` | `${number}rem` | `${number}em`;
