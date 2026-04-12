import LyricComponent, { LyricRef } from "@mahiru/ui/public/components/lyric/LyricContainer";
import Control from "./Control";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import AppBus from "@mahiru/ui/public/entry/bus";
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { cx } from "@emotion/css";
import { WindowResize } from "@mahiru/ui/public/hooks/useWindowResize";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";
import { NeteaseLyric } from "@mahiru/ui/public/models/netease";
import AppWindow from "@mahiru/ui/public/entry/window";

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
  const playerBus = useListenableHook(AppBus.player);
  const infoBus = useListenableHook(AppBus.info);
  const progressBus = useListenableHook(AppBus.progress);
  const getInfo = useRef({
    playerBus,
    infoBus
  });
  getInfo.current = {
    playerBus,
    infoBus
  };
  // 歌词实例
  const [lyric, setLyric] = useState<Nullable<NeteaseLyric>>(null);
  const lyricKey = useRef("");
  useEffect(() => {
    if (!playerBus.data?.lyric) return setLyric(null);
    const newLyric = new NeteaseLyric(playerBus.data.lyric);
    if (newLyric.key === lyricKey.current) return;
    lyricKey.current = newLyric.key;
    setLyric(newLyric);
  }, [playerBus.data?.lyric]);
  // 歌词播放同步
  useEffect(() => {
    let lastTime = 0;
    let isRunning = playerBus.data?.status === "playing";

    const onFrame = (time: number) => {
      if (!isRunning) return;

      const { playerBus } = getInfo.current;
      if (playerBus.data?.status !== "playing") {
        isRunning = false;
        return;
      }

      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      // 自己更新时间
      lyricRef.current?.update(delta);

      requestAnimationFrame(onFrame);
    };

    requestAnimationFrame(onFrame);
    return () => {
      isRunning = false;
    };
  }, [playerBus.data?.status]);
  useEffect(() => {
    // 关键时间点同步
    lyricRef.current?.setCurrentTime((progressBus.data?.currentTime || 0) * 1000);
  }, [progressBus.data?.currentTime]);
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
  const [reverseControl, setReverseControl] = useState(true);
  useLayoutEffect(() => {
    const update = () => {
      AppWindow.current.bounds.then(({ x, y, height, workAreaHeight }) => {
        const screenHeight = window.screen.height;
        if (y < screenHeight / 10) setReverseControl(true);
        else if (y + height > (screenHeight * 9) / 10) setReverseControl(false);
        console.log(y, height, workAreaHeight, screenHeight);
        if (y + height > workAreaHeight) {
          AppWindow.current.move({
            x,
            y: Math.max(workAreaHeight - height, 0)
          });
        }
      });
    };
    update();
    return AppWindow.current.bus("moved", update);
  }, []);

  return (
    <div
      className={cx(
        `w-screen h-screen overflow-hidden relative flex rounded-md`,
        reverseControl ? "flex-col-reverse" : "flex-col"
      )}>
      <div
        className={cx(
          "w-screen flex-1 relative overflow-hidden flex flex-col justify-center items-center ease-in-out transition-all duration-300",
          showBg && "bg-black/10 rounded-lg",
          lock && "bg-transparent"
        )}
        onClick={handleClick}
        onMouseOver={handleMouseOver}>
        <div className={cx("w-full h-full p-2 overflow-hidden", lock && "pointer-events-none")}>
          <LyricComponent
            mainAlign={reverseControl ? "top" : "bottom"}
            crossAlign="center"
            lyric={lyric}
            spring={false}
            ref={lyricRef}
            fontSize={fontSize}
            rmActive={playerBus.data?.rmActive}
            tlActive={playerBus.data?.tlActive}
            activeColor={(color ?? infoBus.data?.theme.mainColor) || "#ffffff"}
          />
        </div>
      </div>
      <Control
        lock={lock}
        lyric={lyric}
        color={color}
        showBg={showBg}
        setLock={setLock}
        fontSize={fontSize}
        setColor={setColor}
        setFontSize={setFontSize}
        rmActive={playerBus.data?.rmActive}
        tlActive={playerBus.data?.tlActive}
      />
      <WindowResize disable={lock || !showBg} showArea={false} />
    </div>
  );
}
