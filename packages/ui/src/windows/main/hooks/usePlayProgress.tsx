import { useAnimate } from "motion/react";
import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { clamp, throttle } from "lodash-es";
import AppEntry from "@mahiru/ui/windows/main/entry";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

export function usePlayProgress() {
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [chorus, setChorus] = useState<NeteaseAPI.NeteaseChorusData[]>([]);
  const [chorusPercent, setChorusPercent] = useState<number[]>([]);
  const player = AppEntry.usePlayer();
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(0);
  const isDragging = useRef(false);

  // 进度条动画
  const updatePercent = useCallback(
    (percent: number, duration?: number) => {
      if (duration === undefined) duration = document.hidden ? 0 : 1;
      percentAnimate(percentScope.current, { width: `${percent}%` }, { duration, ease: "linear" });
    },
    [percentAnimate, percentScope]
  );

  // 缓冲条动画
  const updateBuffer = useCallback(
    (buffer: number, duration?: number) => {
      if (duration === undefined) duration = buffer <= 1 || document.hidden ? 0 : 1;
      bufferAnimate(bufferScope.current, { width: `${buffer}%` }, { duration, ease: "linear" });
    },
    [bufferAnimate, bufferScope]
  );

  // 同步函数
  const tick = useCallback(
    (force: boolean = false) => {
      if (!force && isDragging.current) return;
      const { buffered, currentTime, duration } = player.audio.progress;
      const percent = !duration ? 0 : (currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      updatePercent(percent);
      updateBuffer(buffer);
    },
    [player.audio.progress, updateBuffer, updatePercent]
  );

  const tickRef = useRef(tick);
  tickRef.current = tick;
  // prettier-ignore
  const throttleTick = useRef(
    throttle((force?: boolean) => tickRef.current(force), 1000)
  ).current;

  // 监听事件，自然更新
  useEffect(() => {
    const handleTimeUpdate = () => throttleTick();
    const handleLoad = () => throttleTick(true);
    player.audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    player.audio.addEventListener("loadstart", handleLoad, { passive: true });
    document.addEventListener("visibilitychange", handleLoad, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", handleTimeUpdate);
      player.audio.removeEventListener("loadstart", handleLoad);
      document.removeEventListener("visibilitychange", handleLoad);
    };
  }, [player, throttleTick]);

  // 点击和拖拽
  const calcPercent = useCallback((clientX: number) => {
    const element = barRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return clamp(percent, 0, 100);
  }, []);

  // 点击进度条
  const handleBarClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isDragging.current) return;
      const percent = calcPercent(e.clientX);
      dragPercentRef.current = percent;
      player.audio.currentTime = `${percent}%`;
    },
    [calcPercent, player.audio]
  );

  // 拖拽进度条
  const handleBarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      const mouseMoveHandler = (e: MouseEvent) => {
        const percent = calcPercent(e.clientX);
        dragPercentRef.current = percent;
        updatePercent(percent, 0);
      };
      const mouseUpHandler = () => {
        player.audio.currentTime = `${dragPercentRef.current}%`;
        clearListeners();
      };
      function clearListeners() {
        isDragging.current = false;
        window.removeEventListener("mousemove", mouseMoveHandler);
        window.removeEventListener("mouseup", mouseUpHandler);
      }
      window.addEventListener("mousemove", mouseMoveHandler);
      window.addEventListener("mouseup", mouseUpHandler);
      return clearListeners;
    },
    [calcPercent, player, updatePercent]
  );

  // 获取歌曲副歌时间
  useEffect(() => {
    const fetchChorus = async () => {
      if (!player.current.track) return;
      try {
        const response = await NeteaseAPI.Track.chorus(player.current.track.id);
        const duration = player.audio.instance.duration;
        setChorus(response.chorus);
        setChorusPercent(
          response.chorus.map((c) => (c.startTime / (1000 * duration)) * 100).map(Math.floor)
        );
      } catch {
        setChorus([]);
        setChorusPercent([]);
      }
    };
    player.audio.addEventListener("loadedmetadata", fetchChorus);
    return () => player.audio.removeEventListener("loadedmetadata", fetchChorus);
  }, [player]);

  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying: player.playing,
    isDragging,
    chorus,
    chorusPercent
  };
}
