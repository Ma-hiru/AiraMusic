import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useImmer } from "use-immer";
import { useAnimate } from "motion/react";
import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";

export function usePlayProgress() {
  const { getProgress, isPlaying, changeCurrentTime, audioRef, info } = usePlayer();
  const [progress, setProgress] = useImmer({
    percent: 0,
    buffer: 0,
    currentTime: 0,
    duration: 0
  });
  const [percentScope, percentAnimate] = useAnimate();
  const [bufferScope, bufferAnimate] = useAnimate();
  const [isDragging, setIsDragging] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(0);
  const getPlaying = useRef(isPlaying);
  const getDragging = useRef(isDragging);
  getDragging.current = isDragging;
  getPlaying.current = isPlaying;
  // 播放同步
  const tick = useCallback(
    (force: boolean = false) => {
      if (!force && (getDragging.current || !getPlaying.current)) return;
      const { buffered, currentTime, duration } = getProgress();
      const percent = !duration ? 0 : (currentTime / duration) * 100;
      const buffer = !duration ? 0 : (buffered / duration) * 100;
      setProgress({ percent, buffer, currentTime, duration });
    },
    [getProgress, setProgress]
  );
  useEffect(() => {
    const audio = audioRef.current;
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
  // track change resets progress immediately to avoid sluggish animation after auto-advance
  const lastTrackId = useRef(info.id);
  useEffect(() => {
    if (info.id === lastTrackId.current) return;
    lastTrackId.current = info.id;
    const { duration } = getProgress();
    const nextState = { percent: 0, buffer: 0, currentTime: 0, duration };
    setProgress(nextState);
    if (percentScope.current) {
      percentAnimate(percentScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
    if (bufferScope.current) {
      bufferAnimate(bufferScope.current, { width: "0%" }, { duration: 0, ease: "linear" });
    }
  }, [bufferAnimate, bufferScope, getProgress, info.id, percentAnimate, percentScope, setProgress]);
  // 进度条动画
  useEffect(() => {
    if (!percentScope.current || isDragging) return;
    percentAnimate(
      percentScope.current,
      {
        width: `${progress.percent}%`
      },
      { duration: 0.3, ease: "linear" }
    );
  }, [progress.percent, percentAnimate, percentScope, isDragging]);
  useEffect(() => {
    if (!bufferScope.current || isDragging) return;
    const duration = progress.buffer <= 1 ? 0 : 0.3;
    bufferAnimate(
      bufferScope.current,
      {
        width: `${progress.buffer}%`
      },
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
      const { duration } = getProgress();
      changeCurrentTime((percent / 100) * duration);
      setProgress((draft) => {
        draft.percent = percent;
      });
    },
    [setProgress, calcPercent, getProgress, changeCurrentTime, isDragging]
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
        const { duration } = getProgress();
        changeCurrentTime((finalPercent / 100) * duration);
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
    [calcPercent, changeCurrentTime, getProgress, percentAnimate, percentScope, setProgress]
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

  return {
    barRef,
    handleBarClick,
    handleBarMouseDown,
    percentScope,
    bufferScope,
    isPlaying,
    isDragging,
    progress
  };
}
