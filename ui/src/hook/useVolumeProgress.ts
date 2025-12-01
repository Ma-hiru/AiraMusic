import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react";
import { useAnimate } from "motion/react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

export function useVolumeProgress() {
  const { audioRef, volume } = usePlayer();
  const [percent, setPercent] = useState(() => Math.min(100, Math.max(0, volume * 100)));
  const [isDragging, setIsDragging] = useState(false);
  const [percentScope, percentAnimate] = useAnimate();
  const barRef = useRef<HTMLDivElement>(null);
  const dragPercentRef = useRef(percent);

  useEffect(() => {
    if (isDragging) return;
    const currentVolume = audioRef.current?.volume ?? volume;
    const nextPercent = Math.min(100, Math.max(0, currentVolume * 100));
    setPercent(nextPercent);
  }, [audioRef, isDragging, volume]);

  useEffect(() => {
    if (!percentScope.current || isDragging) return;
    percentAnimate(
      percentScope.current,
      {
        width: `${percent}%`
      },
      { duration: 0.2, ease: "linear" }
    );
  }, [percent, percentAnimate, percentScope, isDragging]);

  const calcPercent = useCallback((clientX: number) => {
    const element = barRef.current;
    if (!element) return 0;
    const rect = element.getBoundingClientRect();
    const nextPercent = ((clientX - rect.left) / rect.width) * 100;
    return Math.min(100, Math.max(0, nextPercent));
  }, []);

  const commitVolume = useCallback(
    (nextPercent: number) => {
      dragPercentRef.current = nextPercent;
      setPercent(nextPercent);
      const audio = audioRef.current;
      if (audio) {
        audio.volume = nextPercent / 100;
      }
    },
    [audioRef]
  );

  const handleBarClick = useCallback(
    (e: ReactMouseEvent) => {
      if (isDragging) return;
      const nextPercent = calcPercent(e.clientX);
      commitVolume(nextPercent);
    },
    [calcPercent, commitVolume, isDragging]
  );

  const mouseMoveHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const mouseUpHandlerRef = useRef<NormalFunc<[MouseEvent]>>(() => {});
  const isListenerAttachedRef = useRef(false);

  const handleBarMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      mouseMoveHandlerRef.current = (event) => {
        const nextPercent = calcPercent(event.clientX);
        dragPercentRef.current = nextPercent;
        setPercent(nextPercent);
        if (percentScope.current) {
          percentAnimate(
            percentScope.current,
            {
              width: `${nextPercent}%`
            },
            { duration: 0, ease: "linear" }
          );
        }
      };
      mouseUpHandlerRef.current = () => {
        setIsDragging(false);
        commitVolume(dragPercentRef.current);
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
    [calcPercent, commitVolume, percentAnimate, percentScope, setPercent]
  );

  useEffect(() => {
    return () => {
      if (isListenerAttachedRef.current) {
        try {
          window.removeEventListener("mousemove", mouseMoveHandlerRef.current);
          window.removeEventListener("mouseup", mouseUpHandlerRef.current);
        } catch {
          /* empty */
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
    isDragging,
    percent,
    volume: percent / 100
  };
}
