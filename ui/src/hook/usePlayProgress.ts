import { useImmer } from "use-immer";
import { useAnimate } from "motion/react";
import {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { API } from "@mahiru/ui/api";
import { NCMServerErr } from "@mahiru/ui/utils/errs";

export function usePlayProgress() {
  const { trackStatus, playerStatus, playerProgress, audioRef, audioControl } = usePlayerStatus([
    "trackStatus",
    "playerStatus",
    "playerProgress",
    "audioRef",
    "audioControl"
  ]);
  const [progress, setProgress] = useImmer({
    percent: 0,
    buffer: 0,
    currentTime: 0,
    duration: 0
  });
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [isDragging, setIsDragging] = useState(false);
  const [chorus, setChorus] = useState<NeteaseChorusData[]>([]);
  const track = trackStatus?.track;
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(0);
  const getPlaying = useRef(playerStatus.playing);
  const getDragging = useRef(isDragging);
  getDragging.current = isDragging;
  getPlaying.current = playerStatus.playing;
  // 一次播放同步函数
  const tick = useCallback(
    (force: boolean = false) => {
      if (!force && getDragging.current) return;
      const { buffered, currentTime, duration } = playerProgress.current();
      const percent = !duration ? 0 : (currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      setProgress({ percent, buffer, currentTime, duration });
    },
    [playerProgress, setProgress]
  );
  // 监听音频事件，自然更新
  useEffect(() => {
    const audio = audioRef.current();
    if (!audio) return;
    const handleTimeUpdate = () => tick();
    const handleLoad = () => tick(true);
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
  }, [audioRef, tick]);
  // 切歌快速重置进度条
  const lastTrackId = useRef(track?.id);
  useEffect(() => {
    if (!track || track.id === lastTrackId.current) return;
    lastTrackId.current = track.id;
    const { duration } = playerProgress.current();
    const nextState = { percent: 0, buffer: 0, currentTime: 0, duration };
    setProgress(nextState);
    if (percentScope.current) {
      percentAnimate(percentScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
    if (bufferScope.current) {
      bufferAnimate(bufferScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
  }, [
    bufferAnimate,
    bufferScope,
    percentAnimate,
    percentScope,
    playerProgress,
    setProgress,
    track
  ]);
  // 进度条动画
  useEffect(() => {
    if (!percentScope.current || isDragging) return;
    const duration = getPlaying.current && !document.hidden ? 0.3 : 0;
    percentAnimate(
      percentScope.current,
      { width: `${progress.percent}%` },
      { duration, ease: "linear" }
    );
  }, [progress.percent, percentAnimate, percentScope, isDragging]);
  useEffect(() => {
    if (!bufferScope.current || isDragging) return;
    const duration = progress.buffer <= 1 || document.hidden ? 0 : 0.3;
    bufferAnimate(
      bufferScope.current,
      { width: `${progress.buffer}%` },
      { duration, ease: "linear" }
    );
  }, [progress.buffer, bufferAnimate, bufferScope, isDragging]);
  // 点击和拖拽
  const mouseMoveHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const mouseUpHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const isListenerAttachedRef = useRef(false);
  const calcPercent = useCallback((clientX: number) => {
    const element = barRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const percent = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, percent));
  }, []);
  const handleBarClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isDragging) return;
      const percent = calcPercent(e.clientX);
      dragPercentRef.current = percent;
      const { duration } = playerProgress.current();
      audioControl.current()?.changeCurrentTime((percent / 100) * duration);
      setProgress((draft) => {
        draft.percent = percent;
      });
      if (percentScope.current) {
        percentAnimate(
          percentScope.current,
          { width: `${percent}%` },
          { duration: 0, ease: "linear" }
        );
      }
    },
    [
      audioControl,
      calcPercent,
      isDragging,
      percentAnimate,
      percentScope,
      playerProgress,
      setProgress
    ]
  );
  const handleBarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      mouseMoveHandlerRef.current = (e) => {
        const percent = calcPercent(e.clientX);
        dragPercentRef.current = percent;
        setProgress((draft) => {
          draft.percent = percent;
        });
        if (percentScope.current) {
          percentAnimate(
            percentScope.current,
            {
              width: `${percent}%`
            },
            { duration: 0, ease: "linear" }
          );
        }
      };
      mouseUpHandlerRef.current = () => {
        setIsDragging(false);
        const finalPercent = dragPercentRef.current;
        const { duration } = playerProgress.current();
        audioControl.current()?.changeCurrentTime((finalPercent / 100) * duration);
        if (isListenerAttachedRef.current) {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", mouseUpHandlerRef.current);
          isListenerAttachedRef.current = false;
        }
      };
      window.addEventListener("mousemove", mouseMoveHandlerRef.current);
      window.addEventListener("mouseup", mouseUpHandlerRef.current);
      isListenerAttachedRef.current = true;
    },
    [audioControl, calcPercent, percentAnimate, percentScope, playerProgress, setProgress]
  );
  useEffect(() => {
    return () => {
      if (isListenerAttachedRef.current) {
        try {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", mouseUpHandlerRef.current);
        } catch {
          /*empty*/
        }
        isListenerAttachedRef.current = false;
      }
    };
  }, []);
  // 页面可见性变化时强制更新一次
  useEffect(() => {
    const handleVisibility = () => tick(true);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [tick]);
  // 获取歌曲副歌时间
  useEffect(() => {
    trackStatus &&
      API.Track.getTrackChorus(trackStatus.track.id)
        .then((response) => {
          if (Array.isArray(response.chorus)) {
            setChorus(response.chorus);
          } else {
            setChorus([]);
          }
        })
        .catch((err) => {
          setChorus([]);
          if (NCMServerErr.eq(err)) {
            // TODO
          }
        });
  }, [trackStatus]);
  const chorusPercent = useMemo(() => {
    const duration = playerProgress.current().duration;
    if (!duration || duration <= 0) return [];
    return chorus.map((c) => (c.startTime / (1000 * duration)) * 100);
  }, [chorus, playerProgress]);
  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying: playerStatus.playing,
    isDragging,
    progress,
    chorus,
    chorusPercent
  };
}
