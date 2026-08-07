import { cx } from "@emotion/css";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  type MouseEvent as ReactMouseEvent
} from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLyricSyncFromBus } from "@/common/hooks/use-lyric-sync-from-bus";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { useStableLyricInstanceFromBus } from "@/common/hooks/use-stable-lyric-instance-from-bus";
import WindowResizeArea from "@/common/components/layout/window-resize-area";
import LyricComponent, { type LyricRef } from "@/common/components/display/lyric";

import Control from "./control";

export default function LyricPage() {
  useAppLoaded();
  const lyricRef = useRef<LyricRef>(null);
  const [showBg, setShowBg] = useState(false);
  const [lock, setLock] = useState(false);
  const [color, setColor] = useState(() => {
    return window.localStorage.getItem("lyricWindowColor") || undefined;
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    return Number(window.localStorage.getItem("lyricWindowFontSize")) || 16;
  });
  const showBgTimer = useRef<Nullable<ReturnType<typeof setTimeout>>>(null);
  // 监听播放器相关事件
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const themeBus = useThemeInjectFromBus();
  // 歌词实例
  const lyric = useStableLyricInstanceFromBus(trackMetaBus.data?.lyric);
  // 歌词播放同步
  useLyricSyncFromBus(lyricRef);
  // 颜色变化
  useEffect(() => {
    if (color !== undefined) window.localStorage.setItem("lyricWindowColor", color);
    else window.localStorage.removeItem("lyricWindowColor");
  }, [color]);
  // 字体大小变化
  useEffect(() => {
    window.localStorage.setItem("lyricWindowFontSize", String(fontSize));
  }, [fontSize]);
  // 点击或鼠标移入显示背景
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
  // control组件始终在屏幕边缘一侧，歌词组件在屏幕内部一侧
  const [reverseControl, setReverseControl] = useState(false);
  useLayoutEffect(() => {
    const update = () => {
      RendererWindow.current.bounds.then(({ x, y, height, workAreaHeight }) => {
        const screenHeight = window.screen.height;
        if (y < screenHeight / 10) setReverseControl(false);
        else if (y + height > (screenHeight * 9) / 10) setReverseControl(true);
        if (y + height > workAreaHeight) {
          RendererWindow.current.move({
            x,
            y: Math.max(workAreaHeight - height, 0)
          });
        }
      });
    };
    update();
    return RendererWindow.current.addEventListener("moved", update);
  }, []);

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta");
  }, []);

  return (
    <div
      className={cx(
        `w-screen h-screen overflow-hidden relative flex rounded-md`,
        !reverseControl ? "flex-col-reverse" : "flex-col"
      )}>
      <div
        className={cx(
          "w-screen flex-1 relative overflow-hidden flex flex-col justify-center items-center ease-in-out transition-all duration-300",
          showBg && "bg-primary-text/10 rounded-lg",
          lock && "bg-transparent"
        )}
        onClick={handleClick}
        onMouseOver={handleMouseOver}>
        <div
          className={cx(
            "w-full h-full overflow-hidden contain-strict",
            lock && "pointer-events-none"
          )}>
          <LyricComponent
            ref={lyricRef}
            lyric={lyric}
            spring={false}
            mainAlign="center"
            crossAlign="center"
            fontSize={fontSize}
            rmActive={trackMetaBus.data?.rmActive}
            tlActive={trackMetaBus.data?.tlActive}
            noteActive={trackMetaBus.data?.noteActive}
            playing={trackMetaBus.data?.status === "playing"}
            activeColor={(color ?? themeBus.data?.theme.mainColor) || "#ffffff"}
          />
        </div>
      </div>
      <Control
        lock={lock}
        color={color}
        lyric={lyric}
        showBg={showBg}
        setLock={setLock}
        fontSize={fontSize}
        setColor={setColor}
        setFontSize={setFontSize}
        controlReverse={reverseControl}
        rmActive={trackMetaBus.data?.rmActive}
        tlActive={trackMetaBus.data?.tlActive}
        themeColor={themeBus.data?.theme.mainColor}
      />
      <WindowResizeArea showArea={false} disable={lock || !showBg} />
    </div>
  );
}
