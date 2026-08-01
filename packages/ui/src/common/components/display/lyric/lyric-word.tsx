import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useCallback,
  useLayoutEffect,
  type CSSProperties
} from "react";

import type { TimeManager } from "./time-manager";

interface LyricWordProps {
  word: LyricWord;
  wordIndex: number;
  waitLine?: boolean;
  activeColor?: string;
  lineActive?: boolean;
  singleWord?: boolean;
  notesContent?: string;
  inactiveColor?: string;
  activeWordIndex: number;
  timeManager: TimeManager;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricWord: FC<LyricWordProps> = ({
  timeManager,
  onClick,
  word,
  waitLine,
  wordIndex,
  activeColor,
  notesContent,
  inactiveColor,
  activeWordIndex,
  lineActive = false,
  singleWord = false
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

  const active = wordIndex <= activeWordIndex && lineActive;
  const isCurrentWord = wordIndex === activeWordIndex && lineActive && !singleWord;

  useLayoutEffect(() => {
    if (!isCurrentWord) return;
    let rafId: number;

    const updateProgress = () => {
      const { end, start, current } = getTime();
      const duration = end - start;
      let p: number;
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
    if (wordIndex < activeWordIndex && lineActive) return "100%";
    return "0%";
  }, [singleWord, wordIndex, activeWordIndex, lineActive]);

  // 上浮时长跟随词时长：快词快起避免拖影，慢词从容，封顶防止拖沓。
  const wrapperStyle = useMemo(
    () =>
      ({
        "--lyric-word-rise": `${Math.round(
          Math.min(Math.max((word.endTime - word.startTime) * 0.8, 160), 420)
        )}ms`
      }) as CSSProperties,
    [word.endTime, word.startTime]
  );

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
    <span className="inline-block relative contain-layout" style={wrapperStyle}>
      <span
        ref={spanRef}
        className={cx(
          `
          lyric-word font-semibold whitespace-pre-wrap
        `,
          // 非单行歌词且未高亮时模糊
          !singleWord && wordIndex > activeWordIndex ? "blur-[1.5px]" : "blur-none",
          !singleWord && wordIndex === activeWordIndex && active
            ? "lyric-word-active"
            : "lyric-word-inactive"
        )}
        style={style}
        onClick={handleClick}>
        {waitLine && !lineActive ? "" : word.word}
      </span>
      {notesContent && (
        <span
          className={cx(
            `absolute left-1/2 -translate-x-1/2 -translate-y-full top-[45%] z-10 whitespace-nowrap scale-45`,
            // 非单行歌词且未高亮时模糊
            !singleWord && wordIndex > activeWordIndex ? "blur-[1.5px]" : "blur-none",
            !singleWord && wordIndex === activeWordIndex && active
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
