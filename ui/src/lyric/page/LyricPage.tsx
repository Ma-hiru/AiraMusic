import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { useThemeSyncReceive } from "@mahiru/ui/public/hooks/useThemeSyncReceive";
import { usePlayerProgressSyncReceive } from "@mahiru/ui/public/hooks/usePlayerProgressSyncReceive";
import { usePlayerStatusSyncReceive } from "@mahiru/ui/public/hooks/usePlayerStatusSyncReceive";
import { usePlayerTrackSyncReceive } from "@mahiru/ui/public/hooks/usePlayerTrackSyncReceive";
import { PlayerFSMStatusEnum, Stage } from "@mahiru/ui/public/enum";
import { WindowResize } from "@mahiru/ui/public/hooks/useWindowResize";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";

import LyricComponent, { LyricRef } from "@mahiru/ui/public/components/lyric/LyricContainer";
import Control from "./Control";

export default function LyricPage() {
  useAppLoaded(true, { broadcast: true });

  const { stage } = useStage();
  const lyricRef = useRef<LyricRef>(null);
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
    let lastTime = 0;
    let isRunning = playerStatusSync?.fsmState === PlayerFSMStatusEnum.playing;

    const onFrame = (time: number) => {
      if (!isRunning) return;

      const { playerStatusSync, progressSync } = getInfo.current;
      if (playerStatusSync?.fsmState !== PlayerFSMStatusEnum.playing) {
        isRunning = false;
        return;
      }

      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      lyricRef.current?.update(delta);
      lyricRef.current?.setCurrentTime(progressSync.currentTime * 1000 || 0);

      requestAnimationFrame(onFrame);
    };

    requestAnimationFrame(onFrame);
    return () => {
      isRunning = false;
    };
  }, [playerStatusSync?.fsmState]);
  // 颜色变化
  useEffect(() => {
    if (color !== undefined) window.localStorage.setItem("lyricWindowColor", color);
    else window.localStorage.removeItem("lyricWindowColor");
  }, [color]);
  // 字体大小变化
  useEffect(() => {
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
        <div className={cx("w-full h-full overflow-hidden", lock && "pointer-events-none")}>
          <LyricComponent
            ref={lyricRef}
            fontSize={fontSize}
            activeColor={(color ?? themeSync.mainColor) || "#ffffff"}
            lyric={trackSync?.lyric}
            version={playerStatusSync?.lyricVersion}
            crossAlign="center"
            mainAlign="top"
          />
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
          lock={lock}
          setLock={setLock}
          fontSize={fontSize}
          setFontSize={setFontSize}
        />
      )}
      {stage >= Stage.Finally && <WindowResize disable={lock || !showBg} showArea={false} />}
    </div>
  );
}
