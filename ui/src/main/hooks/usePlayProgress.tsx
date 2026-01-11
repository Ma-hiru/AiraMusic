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
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";
import { API } from "@mahiru/ui/public/api";

export function usePlayProgress() {
  const {
    PlayerTrackStatus,
    PlayerCoreGetter,
    PlayerProgressGetter,
    AudioRefGetter,
    PlayerFSMStatus,
    PlayerInitialized
  } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerProgressGetter",
    "AudioRefGetter",
    "PlayerCoreGetter",
    "PlayerFSMStatus",
    "PlayerInitialized"
  ]);
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [chorus, setChorus] = useState<NeteaseChorusData[]>([]);
  const track = PlayerTrackStatus?.track;
  const player = PlayerCoreGetter();
  const audio = AudioRefGetter();
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
      const { buffered, currentTime, duration } = PlayerProgressGetter();
      const percent = !duration ? 0 : (currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      updatePercent(percent);
      updateBuffer(buffer);
    },
    [PlayerProgressGetter, updateBuffer, updatePercent]
  );
  const tickRef = useRef(tick);
  tickRef.current = tick;
  // prettier-ignore
  const throttleTick = useRef(
    throttle((force?: boolean) => tickRef.current(force), 1000)
  ).current;
  // 监听音频事件，自然更新
  useEffect(() => {
    if (!audio) return;
    const handleTimeUpdate = () => throttleTick();
    const handleLoad = () => throttleTick(true);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadstart", handleLoad);
    audio.addEventListener("progress", handleLoad);
    audio.addEventListener("waiting", handleLoad);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadstart", handleLoad);
      audio.removeEventListener("progress", handleLoad);
      audio.removeEventListener("waiting", handleLoad);
    };
  }, [audio, throttleTick]);
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
      player.changeCurrentTimeByPercent(percent);
    },
    [calcPercent, player]
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
        player.changeCurrentTimeByPercent(dragPercentRef.current);
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
    if (PlayerFSMStatus !== PlayerFSMStatusEnum.loading) return;
    if (!track || track.id === lastTrackId.current) return;
    API.Track.getTrackChorus(track.id)
      .then(({ chorus }) => setChorus(chorus))
      .catch(() => setChorus([]));
  }, [PlayerFSMStatus, track]);
  const chorusPercent = useMemo(() => {
    const duration = audio?.duration;
    if (!duration || duration <= 0) return [];
    return chorus.map((c) => (c.startTime / (1000 * duration)) * 100);
  }, [audio?.duration, chorus]);
  // 适当时候强制同步一次
  useEffect(() => {
    const cb = () => throttleTick(true);
    PlayerInitialized && cb();
    document.addEventListener("visibilitychange", cb);
    return () => document.removeEventListener("visibilitychange", cb);
  }, [PlayerInitialized, throttleTick]);
  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying: PlayerFSMStatus === PlayerFSMStatusEnum.playing,
    isDragging,
    chorus,
    chorusPercent
  };
}
