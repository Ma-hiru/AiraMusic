import { useAnimate } from "motion/react";
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { clamp, throttle } from "lodash-es";
import AppInstance from "@mahiru/ui/main/entry/instance";
import { AppPlayerStatus } from "@mahiru/ui/public/models/player";
import NCM_API from "@mahiru/ui/public/api";

export function usePlayProgress() {
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [chorus, setChorus] = useState<NeteaseAPI.NeteaseChorusData[]>([]);
  const player = AppInstance.usePlayer();
  const track = player.current.track?.track;
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(0);
  const isDragging = useRef(false);

  // 进度条动画
  const updatePercent = useCallback(
    (percent: number, duration?: number) => {
      if (duration === undefined) {
        duration = document.hidden ? 0 : 1;
      }
      percentAnimate(percentScope.current, { width: `${percent}%` }, { duration, ease: "linear" });
    },
    [percentAnimate, percentScope]
  );
  const updateBuffer = useCallback(
    (buffer: number, duration?: number) => {
      if (duration === undefined) {
        duration = buffer <= 1 || document.hidden ? 0 : 1;
      }
      bufferAnimate(bufferScope.current, { width: `${buffer}%` }, { duration, ease: "linear" });
    },
    [bufferAnimate, bufferScope]
  );
  // 一次播放同步函数
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
  // 监听音频事件，自然更新
  useEffect(() => {
    const handleTimeUpdate = () => throttleTick();
    const handleLoad = () => throttleTick(true);
    player.audio.addEventListener("timeupdate", handleTimeUpdate, { passive: true });
    player.audio.addEventListener("loadstart", handleLoad, { passive: true });
    player.audio.addEventListener("progress", handleLoad, { passive: true });
    player.audio.addEventListener("waiting", handleLoad, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", handleTimeUpdate);
      player.audio.removeEventListener("loadstart", handleLoad);
      player.audio.removeEventListener("progress", handleLoad);
      player.audio.removeEventListener("waiting", handleLoad);
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
  const handleBarClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isDragging.current) return;
      const percent = calcPercent(e.clientX);
      dragPercentRef.current = percent;
      player.audio.currentTime = `${percent}%`;
    },
    [calcPercent, player.audio]
  );
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
  const lastTrackId = useRef(track?.id);
  useEffect(() => {
    if (player.status === AppPlayerStatus.playing) return;
    if (!track || track.id === lastTrackId.current) return;
    NCM_API.Track.chorus(track.id)
      .then(({ chorus }) => setChorus(chorus))
      .catch(() => setChorus([]));
  }, [player.status, track]);

  const chorusPercent = useMemo(() => {
    const duration = player.audio.instance.duration;
    if (!duration || duration <= 0) return [];
    return chorus.map((c) => (c.startTime / (1000 * duration)) * 100);
  }, [chorus, player.audio]);
  // 适当时候强制同步一次
  useEffect(() => {
    const cb = () => throttleTick(true);
    document.addEventListener("visibilitychange", cb);
    return () => document.removeEventListener("visibilitychange", cb);
  }, [throttleTick]);
  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying: player.status === AppPlayerStatus.playing,
    isDragging,
    chorus,
    chorusPercent
  };
}
