import { FC, memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { LyricTimeManager } from "./LyricTimeManager";
import { cx } from "@emotion/css";

import LyricWord from "./LyricWord";

interface LyricLineProps {
  index: number;
  line: LyricLine;
  timeManager: LyricTimeManager;
  active: boolean;
  crossAlign?: "left" | "center" | "right";
  activeColor?: string;
  inactiveColor?: string;
  fontSize?: FontSize | number;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricLine: FC<LyricLineProps> = ({
  line,
  timeManager,
  index,
  active,
  onClick,
  activeColor,
  inactiveColor,
  fontSize,
  crossAlign
}) => {
  const [wordIndex, setWordIndex] = useState(-1);

  const onClickLine = useCallback(() => {
    onClick?.(line.words[0]?.startTime || line.startTime);
  }, [line.startTime, line.words, onClick]);

  useLayoutEffect(() => {
    timeManager.addLineListener(index, setWordIndex);
    return () => timeManager.removeLineListener(index);
  }, [timeManager, index]);

  const allWord = useMemo(() => {
    let result = { ...line.words[0]! };
    if (line.words.length === 0) {
      result = {
        startTime: line.startTime,
        endTime: line.endTime,
        word: "",
        romanWord: ""
      };
    } else if (line.words.length >= 2) {
      result = {
        startTime: line.words[0]!.startTime,
        endTime: line.words[line.words.length - 1]!.endTime,
        word: line.words.map((w) => w.word).join(""),
        romanWord: line.words.map((w) => w.romanWord).join("")
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
    <div
      className={cx(
        `
          w-full px-4 py-1 rounded-md hover:blur-none hover:bg-white/20
          duration-500 ease-in-out transition-all
          contain-content leading-7
    `,
        active ? "text-white" : "text-white/30 blur-[2px]"
      )}>
      <div
        style={style}
        className={cx(
          `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-content
            font-normal text-3xl
        `,
          active && "scale-102 font-medium",
          crossAlign === "left" && "text-left",
          crossAlign === "center" && "text-center",
          crossAlign === "right" && "text-right"
        )}>
        {active ? (
          line.words.map((word, index) => (
            <LyricWord
              key={index}
              word={word}
              activeColor={activeColor}
              inactiveColor={inactiveColor}
              fontSize={fontSize}
              wordIndex={index}
              currentWordIndex={wordIndex}
              onClick={onClick}
              lineActive={active}
              singleWord={line.words.length === 1}
            />
          ))
        ) : (
          <LyricWord
            singleWord
            wordIndex={0}
            currentWordIndex={0}
            word={allWord}
            onClick={onClick}
            activeColor={activeColor}
            inactiveColor={inactiveColor}
            fontSize={fontSize}
          />
        )}
      </div>
      <div
        className={cx(
          `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-content
            font-normal text-md
          `,
          active && "scale-102 font-medium"
        )}
        onClick={onClickLine}>
        {line.translatedLyric}
      </div>
      <div
        className={cx(
          `
            text-wrap select-none
            duration-500 ease-in-out transition-all
            contain-content
            font-normal text-md
          `,
          active && "scale-102 font-medium"
        )}
        onClick={onClickLine}>
        {line.romanLyric}
      </div>
    </div>
  );
};
export default memo(LyricLine);
