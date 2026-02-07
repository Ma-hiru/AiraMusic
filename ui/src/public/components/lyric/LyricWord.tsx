import { FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";

interface LyricWordProps {
  word: LyricWord;
  wordIndex: number;
  currentWordIndex: number;
  lineActive?: boolean;
  singleWord?: boolean;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricWord: FC<LyricWordProps> = ({
  word,
  wordIndex,
  currentWordIndex,
  lineActive = false,
  singleWord = false,
  onClick
}) => {
  const handleClick = useCallback(() => {
    onClick?.(word.startTime);
  }, [onClick, word.startTime]);

  return (
    <span
      onClick={handleClick}
      className={cx(
        `
          relative inline
          text-3xl font-semibold
          duration-1000 ease-in-out transition-all
        `,
        wordIndex <= currentWordIndex && lineActive ? "text-white" : "text-white/30",
        !singleWord && wordIndex === currentWordIndex && lineActive && "-top-px"
      )}>
      {word.word}
    </span>
  );
};
export default memo(LyricWord);
