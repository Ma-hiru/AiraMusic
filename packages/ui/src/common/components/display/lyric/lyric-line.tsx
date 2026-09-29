import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useState, useCallback, useLayoutEffect } from "react";

import LyricWord from "./lyric-word";
import type { LyricLineExtended } from "./utils";
import type { TimeManager } from "./time-manager";

interface LyricLineProps {
  /** 歌词行序号 */
  index: number;
  /** 歌词行是否激活 */
  active: boolean;
  spring?: boolean;
  fontSize?: number;
  activeColor?: string;
  inactiveColor?: string;
  line: LyricLineExtended;
  hasRm: Optional<boolean>;
  hasTl: Optional<boolean>;
  rmActive: Optional<boolean>;
  tlActive: Optional<boolean>;
  noteActive: Optional<boolean>;
  crossAlign?: "left" | "right" | "center";
  timeManager: TimeManager;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricLine: FC<LyricLineProps> = ({
  timeManager,
  onClick,
  line,
  hasRm,
  hasTl,
  index,
  active,
  fontSize,
  rmActive,
  tlActive,
  noteActive,
  activeColor,
  inactiveColor,
  spring = true,
  crossAlign = "left"
}) => {
  if (line.isBlank || line.isBackChorus || line.isBG) {
    if (crossAlign === "left" || crossAlign === "center") crossAlign = "right";
    else if (crossAlign === "right") crossAlign = "left";
  }
  const [wordIndex, setWordIndex] = useState(-1);

  const onClickLine = useCallback(() => {
    onClick?.(line.words[0]?.startTime || line.startTime);
  }, [line.startTime, line.words, onClick]);

  useLayoutEffect(() => {
    if (!active) return;
    const syncWordIndex = () => {
      // 同时演唱的行会增减；按固定行号查找，不能捕获激活数组中的旧位置
      const activeIndex = timeManager.getCurrentLineIndex().indexOf(index);
      const idx = timeManager.getCurrentWordIndex()[activeIndex];
      setWordIndex(idx ?? -1);
    };
    syncWordIndex();
    const removeLineListener = timeManager.addEventListener("line-change", syncWordIndex);
    const removeWordListener = timeManager.addEventListener("word-change", syncWordIndex);
    return () => {
      removeLineListener();
      removeWordListener();
    };
  }, [timeManager, index, active]);

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
      className={cx(
        `
          w-full px-4 py-1 rounded-md hover:blur-none hover:bg-(--text-color)/20
          duration-500 ease-in-out transition-all
          contain-layout leading-normal text-3xl
      `,
        !active && "blur-[2px] opacity-50"
      )}
      style={style}>
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
            const notesContent = noteActive
              ? inlineNoteContent || word.romanWord?.trim()
              : undefined;
            return (
              !word.inlineNote && (
                <LyricWord
                  key={index}
                  word={word}
                  wordIndex={index}
                  lineActive={active}
                  waitLine={!!line.wait}
                  activeColor={activeColor}
                  timeManager={timeManager}
                  activeWordIndex={wordIndex}
                  inactiveColor={inactiveColor}
                  singleWord={line.words.length === 1}
                  notesContent={notesContent || undefined}
                  onClick={onClick}
                />
              )
            );
          })
        ) : (
          <LyricWord
            wordIndex={0}
            word={allWord}
            lineActive={false}
            activeWordIndex={0}
            waitLine={!!line.wait}
            activeColor={activeColor}
            timeManager={timeManager}
            inactiveColor={inactiveColor}
            onClick={onClick}
            singleWord
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
