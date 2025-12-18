import Control from "@mahiru/ui/page/lyric/Control";
import {
  FC,
  memo,
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { LyricPlayer, LyricPlayerRef } from "@mahiru/ui/componets/player/LyricPlayer";
import { cx } from "@emotion/css";
import { WindowResize } from "@mahiru/ui/hook/useWindowResize";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { UI } from "@mahiru/ui/utils/ui";
import { LyricManager } from "@mahiru/ui/utils/lyricManager";

const LyricPage: FC<object> = () => {
  const lyricPlayerRef = useRef<LyricPlayerRef>(null);
  const [showBg, setShowBg] = useState(false);
  const [lock, setLock] = useState(false);
  const [lyricSync, setLyricSync] = useState<LyricSync>();
  const [lyricInit, setLyricInit] = useState<LyricInit>();
  const [color, setColor] = useState(() => {
    return window.localStorage.getItem("lyricWindowColor") || undefined;
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    return (window.localStorage.getItem("lyricWindowFontSize") as FontSize) || "16px";
  });
  const showBgTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);

  // 同步信息
  useEffect(() => {
    const removeInitListener = Renderer.addMessageHandler("lyricInit", "main", setLyricInit);
    const removeSyncListener = Renderer.addMessageHandler("lyricSync", "main", setLyricSync);

    return () => {
      removeInitListener();
      removeSyncListener();
    };
  }, []);
  // 歌词播放同步
  useEffect(() => {
    let rafId = 0;
    let lastTime = 0;
    const onFrame = (time: number) => {
      if (!lyricSync || !lyricSync.playerStatus.playing) return;
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      lyricPlayerRef.current?.lyricPlayer?.update(delta);
      lyricPlayerRef.current?.lyricPlayer?.setCurrentTime(
        (lyricSync.progress.currentTime * 1000) | 0
      );

      rafId = requestAnimationFrame(onFrame);
    };
    if (lyricSync?.playerStatus.playing) {
      rafId = requestAnimationFrame(onFrame);
    }
    return () => cancelAnimationFrame(rafId);
  }, [lyricSync]);
  // 颜色变化
  useEffect(() => {
    if (color !== undefined) {
      UI.AMLyricColor = color;
      window.localStorage.setItem("lyricWindowColor", color);
    } else {
      UI.AMLyricColor = lyricSync?.themeColor || "#ffffff";
      window.localStorage.removeItem("lyricWindowColor");
    }
  }, [color, lyricSync?.themeColor]);
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
          <LyricPlayer
            ref={lyricPlayerRef}
            playing={lyricSync?.playerStatus.playing}
            className="w-full h-full"
            alignAnchor="center"
            hidePassedLines
            lyricLines={LyricManager.chooseLyric(
              lyricInit?.trackStatus.lyric,
              lyricSync?.playerStatus.lyricVersion
            )}
            enableScale={false}
            enableSpring={false}
          />
        </div>
      </div>
      <Control
        color={color}
        setColor={setColor}
        lyricSync={lyricSync}
        lyricInit={lyricInit}
        showBg={showBg}
        setShowBg={setShowBg}
        lock={lock}
        setLock={setLock}
        fontSize={fontSize}
        setFontSize={setFontSize}
      />
      <WindowResize disable={lock || !showBg} showArea={false} />
    </div>
  );
};
export default memo(LyricPage);

type FontSize = `${number}px` | `${number}rem` | `${number}em`;
