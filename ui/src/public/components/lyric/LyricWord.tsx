import { CSSProperties, FC, memo, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { cx } from "@emotion/css";
import { LyricTimeManager } from "@mahiru/ui/public/components/lyric/LyricTimeManager";

interface LyricWordProps {
  word: LyricWord;
  wordIndex: number;
  currentWordIndex: number;
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: FontSize | number;
  lineActive?: boolean;
  singleWord?: boolean;
  onClick?: NormalFunc<[startTime: number]>;
  timeManager: LyricTimeManager;
}

const LyricWord: FC<LyricWordProps> = ({
  word,
  wordIndex,
  currentWordIndex,
  lineActive = false,
  singleWord = false,
  activeColor,
  inactiveColor,
  fontSize,
  onClick,
  timeManager
}) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  const handleClick = useCallback(() => {
    onClick?.(word.startTime);
  }, [onClick, word.startTime]);

  const getTime = useCallback(() => {
    const current = timeManager.getCurrentTime();
    return {
      current,
      start: word.startTime,
      end: word.endTime
    };
  }, [timeManager, word.endTime, word.startTime]);

  const active = wordIndex <= currentWordIndex && lineActive;
  const isCurrentWord = wordIndex === currentWordIndex && lineActive && !singleWord;

  useLayoutEffect(() => {
    if (!isCurrentWord) return;
    let rafId: number;

    const updateProgress = () => {
      const { current, start, end } = getTime();
      const duration = end - start;
      let p = 0;
      if (duration > 0) {
        p = Math.max(0, Math.min(100, ((current - start) / duration) * 100));
      } else {
        p = current >= start ? 100 : 0;
      }

      if (spanRef.current) {
        spanRef.current.style.setProperty("--progress", `${p}%`);
      }

      if (p < 100) {
        rafId = requestAnimationFrame(updateProgress);
      }
    };

    rafId = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(rafId);
  }, [isCurrentWord, getTime]);

  const progress = useMemo(() => {
    if (singleWord) return "0%";
    if (wordIndex < currentWordIndex && lineActive) return "100%";
    return "0%";
  }, [singleWord, wordIndex, currentWordIndex, lineActive]);

  const style = useMemo(
    () =>
      ({
        color: singleWord ? (active ? activeColor : inactiveColor) : undefined,
        backgroundImage: !singleWord
          ? `linear-gradient(to right, ${activeColor || "rgba(255, 255, 255, 1)"} var(--progress), ${
              inactiveColor || "rgba(255, 255, 255, 0.3)"
            } var(--progress))`
          : undefined,
        WebkitBackgroundClip: !singleWord ? "text" : undefined,
        WebkitTextFillColor: !singleWord ? "transparent" : undefined,
        "--progress": progress,
        fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize
      }) as CSSProperties,
    [active, activeColor, fontSize, inactiveColor, progress, singleWord]
  );

  return (
    <span
      ref={spanRef}
      style={style}
      onClick={handleClick}
      className={cx(
        `
          relative inline-block font-normal whitespace-pre-wrap
          duration-500 ease-in-out transition-all
        `,
        wordIndex > currentWordIndex && !singleWord ? "blur-[1.5px]" : "blur-none",
        singleWord && (active ? "text-white" : "text-white/30"),
        !singleWord && (active ? "scale-100" : "scale-95")
      )}>
      {word.word}
    </span>
  );
};

export default memo(LyricWord);
