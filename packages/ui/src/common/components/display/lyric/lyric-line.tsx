import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
import type { TimeManager } from "./time-manager";

import LyricWord from "./lyric-word";

interface LyricLineProps {
  index: number;
  line: LyricLine;
  rmActive: Optional<boolean>;
  tlActive: Optional<boolean>;
  noteActive: Optional<boolean>;
  hasRm: Optional<boolean>;
  hasTl: Optional<boolean>;
  timeManager: TimeManager;
  active: boolean;
  crossAlign?: "left" | "center" | "right";
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: number;
  onClick?: NormalFunc<[startTime: number]>;
  spring?: boolean;
}

const LyricLine: FC<LyricLineProps> = ({
  line,
  rmActive,
  tlActive,
  noteActive,
  hasRm,
  hasTl,
  timeManager,
  index,
  active,
  onClick,
  activeColor,
  inactiveColor,
  fontSize,
  crossAlign = "left",
  spring = true
}) => {
  if (line.isBlank || line.isBackChorus) {
    if (crossAlign === "left" || crossAlign === "center") crossAlign = "right";
    else if (crossAlign === "right") crossAlign = "left";
  }
  const [wordIndex, setWordIndex] = useState(-1);

  const onClickLine = useCallback(() => {
    onClick?.(line.words[0]?.startTime || line.startTime);
  }, [line.startTime, line.words, onClick]);

  useLayoutEffect(() => {
    return timeManager.addEventListener("word-change", () => {
      setWordIndex(timeManager.getCurrentWordIndex());
    });
  }, [timeManager, index]);

  const allWord = useMemo(() => {
    let result = { ...line.words[0]! };
    if (line.words.length === 0) {
      result = {
        startTime: line.startTime,
        endTime: line.endTime,
        word: ""
      };
    } else if (line.words.length >= 2) {
      result = {
        startTime: line.words[0]!.startTime,
        endTime: line.words[line.words.length - 1]!.endTime,
        word: line.words
          .filter((w) => !w.inlineNote)
          .map((w) => w.word)
          .join("")
      };
    }
    return result;
  }, [line.endTime, line.startTime, line.words]);
  const style = useMemo(
    () => ({
      color: active ? activeColor : inactiveColor,
      fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize
    }),
    [active, activeColor, fontSize, inactiveColor]
  );

  return (
    <section
      style={style}
      className={cx(
        `
          w-full px-4 py-1 rounded-md hover:blur-none hover:bg-(--text-color)/20
          duration-500 ease-in-out transition-all
          contain-layout leading-normal text-3xl
    `,
        !active && "blur-[2px] opacity-50"
      )}>
      <div
        className={cx(
          `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-layout
            font-semibold flex flex-wrap
        `,
          active && "font-medium",
          spring && active && "scale-102",
          crossAlign === "left" && "text-left justify-start",
          crossAlign === "center" && "text-center justify-center",
          crossAlign === "right" && "text-right justify-end"
        )}>
        {active ? (
          line.words.map((word, index) => {
            let inlineNoteContent = "";
            if (noteActive && !word.inlineNote && line.words[index + 1]?.inlineNote) {
              for (let i = index + 1; i < line.words.length; i++) {
                if (line.words[i]?.inlineNote) {
                  inlineNoteContent += line.words[i]!.word;
                } else {
                  break;
                }
              }
            }
            inlineNoteContent = trimInlineNoteContent(inlineNoteContent);
            return (
              !word.inlineNote && (
                <LyricWord
                  key={index}
                  word={word}
                  notesContent={inlineNoteContent || undefined}
                  activeColor={activeColor}
                  inactiveColor={inactiveColor}
                  wordIndex={index}
                  currentWordIndex={wordIndex}
                  onClick={onClick}
                  lineActive={active}
                  singleWord={line.words.length === 1}
                  timeManager={timeManager}
                />
              )
            );
          })
        ) : (
          <LyricWord
            singleWord
            wordIndex={0}
            currentWordIndex={0}
            word={allWord}
            onClick={onClick}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            timeManager={timeManager}
          />
        )}
      </div>
      {hasRm && rmActive && !!line.romanLyric && (
        <div
          className={cx(
            `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-content
            font-normal text-[60%]
          `,
            active && "font-medium",
            spring && active && "scale-102",
            crossAlign === "left" && "text-left",
            crossAlign === "center" && "text-center",
            crossAlign === "right" && "text-right"
          )}
          onClick={onClickLine}>
          {line.romanLyric}
        </div>
      )}
      {hasTl && tlActive && !!line.translatedLyric && (
        <div
          className={cx(
            `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-content
            font-normal text-[60%]
          `,
            active && "font-medium",
            spring && active && "scale-102",
            crossAlign === "left" && "text-left",
            crossAlign === "center" && "text-center",
            crossAlign === "right" && "text-right"
          )}
          onClick={onClickLine}>
          {line.translatedLyric}
        </div>
      )}
    </section>
  );
};

export default memo(LyricLine);

const inlineNotePredicates = [
  ["(", ")"],
  ["（", "）"]
] as const;

function trimInlineNoteContent(content: string) {
  const trimmed = content.trim();
  for (const [left, right] of inlineNotePredicates) {
    if (trimmed.startsWith(left) && trimmed.endsWith(right)) {
      return trimmed.slice(left.length, trimmed.length - right.length).trim();
    }
  }
  return trimmed;
}
