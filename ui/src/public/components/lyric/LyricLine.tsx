import { FC, memo, useCallback, useLayoutEffect, useState } from "react";
import { LyricTimeManager } from "./LyricTimeManager";
import { cx } from "@emotion/css";

import LyricWord from "./LyricWord";

interface LyricLineProps {
  index: number;
  line: LyricLine;
  timeManager: Nullable<LyricTimeManager>;
  active: boolean;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricLine: FC<LyricLineProps> = ({ line, timeManager, index, active, onClick }) => {
  const [wordIndex, setWordIndex] = useState(-1);

  const onClickLine = useCallback(() => {
    onClick?.(line.words[0]?.startTime || line.startTime);
  }, [line.startTime, line.words, onClick]);

  useLayoutEffect(() => {
    if (!timeManager) {
      setWordIndex(-1);
      return;
    }
    timeManager.addLineListener(index, setWordIndex);
    return () => {
      timeManager.removeLineListener(index);
    };
  }, [timeManager, index]);

  return (
    <div
      className={cx(
        `
          w-full px-4 py-1 rounded-md
          backdrop-blur-2xl hover:bg-white/20
          text-wrap select-none
          duration-300 ease-in-out transition-all
          hover:blur-none
        `,
        !active && "blur-[2px]"
      )}>
      {line.words.map((word, index) => {
        return (
          <LyricWord
            onClick={onClick}
            key={index}
            word={word}
            highlight={active}
            single={line.words.length === 1 || line.words.length === 0}
            active={index <= wordIndex}
          />
        );
      })}
      <div className={cx(active ? "text-white" : "text-white/30")} onClick={onClickLine}>
        {line.translatedLyric}
      </div>
      <div className={cx(active ? "text-white" : "text-white/30")} onClick={onClickLine}>
        {line.romanLyric}
      </div>
    </div>
  );
};
export default memo(LyricLine);
