import {
  type CSSProperties,
  type FC,
  memo,
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef
} from "react";
import { cx } from "@emotion/css";
import { LyricTimeManager } from "./lyric-time-manager";

interface LyricWordProps {
  word: LyricWord;
  wordIndex: number;
  currentWordIndex: number;
  notesContent?: string;
  activeColor?: string;
  inactiveColor?: string;
  lineActive?: boolean;
  singleWord?: boolean;
  onClick?: NormalFunc<[startTime: number]>;
  timeManager: LyricTimeManager;
}

const LyricWord: FC<LyricWordProps> = ({
  word,
  wordIndex,
  notesContent,
  currentWordIndex,
  lineActive = false,
  singleWord = false,
  activeColor,
  inactiveColor,
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
        "--progress": progress
      }) as CSSProperties,
    [active, activeColor, inactiveColor, progress, singleWord]
  );

  return (
    <span className="inline-block relative contain-layout">
      <span
        ref={spanRef}
        style={style}
        onClick={handleClick}
        className={cx(
          `
          lyric-word font-semibold whitespace-pre-wrap
        `,
          // 非单行歌词且未高亮时模糊
          !singleWord && wordIndex > currentWordIndex ? "blur-[1.5px]" : "blur-none",
          !singleWord && wordIndex === currentWordIndex && active
            ? "lyric-word-active"
            : "lyric-word-inactive"
        )}>
        {word.word}
      </span>
      {notesContent && (
        <span
          className={cx(
            `absolute left-1/2 -translate-x-1/2 -translate-y-full top-1/3 z-10 whitespace-nowrap scale-45`,
            // 非单行歌词且未高亮时模糊
            !singleWord && wordIndex > currentWordIndex ? "blur-[1.5px]" : "blur-none",
            !singleWord && wordIndex === currentWordIndex && active
              ? "lyric-word-active"
              : "lyric-word-inactive"
          )}>
          {notesContent}
        </span>
      )}
    </span>
  );
};

export default memo(LyricWord);
