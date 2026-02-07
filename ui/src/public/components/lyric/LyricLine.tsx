import { FC, memo, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { LyricTimeManager } from "./LyricTimeManager";
import { cx } from "@emotion/css";

import LyricWord from "./LyricWord";

interface LyricLineProps {
  index: number;
  line: LyricLine;
  timeManager: LyricTimeManager;
  active: boolean;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricLine: FC<LyricLineProps> = ({ line, timeManager, index, active, onClick }) => {
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
        romanWord: "",
        obscene: false
      };
    } else if (line.words.length >= 2) {
      result = {
        startTime: line.words[0]!.startTime,
        endTime: line.words[line.words.length - 1]!.endTime,
        word: line.words.map((w) => w.word).join(""),
        romanWord: line.words.map((w) => w.romanWord).join(""),
        obscene: line.words.some((w) => w.obscene)
      };
    }
    return result;
  }, [line.endTime, line.startTime, line.words]);

  return (
    <div
      className={cx(
        `
          w-full px-4 py-1 rounded-md
          text-wrap select-none
          hover:blur-none hover:bg-white/20
          contain-content
        `,
        active ? "text-white" : "text-white/30 blur-[2px]"
      )}>
      {active ? (
        line.words.map((word, index) => (
          <LyricWord
            key={index}
            word={word}
            wordIndex={index}
            currentWordIndex={wordIndex}
            onClick={onClick}
            lineActive={active}
            singleWord={line.words.length === 1}
          />
        ))
      ) : (
        <LyricWord singleWord wordIndex={0} currentWordIndex={0} word={allWord} onClick={onClick} />
      )}
      <div className="text-wrap" onClick={onClickLine}>
        {line.translatedLyric}
      </div>
      <div className="text-wrap" onClick={onClickLine}>
        {line.romanLyric}
      </div>
    </div>
  );
};
export default memo(LyricLine);
