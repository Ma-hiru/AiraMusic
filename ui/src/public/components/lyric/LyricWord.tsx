import { FC, memo, useCallback, useMemo } from "react";
import { cx } from "@emotion/css";

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
  onClick
}) => {
  const handleClick = useCallback(() => {
    onClick?.(word.startTime);
  }, [onClick, word.startTime]);

  const active = wordIndex <= currentWordIndex && lineActive;

  const style = useMemo(
    () => ({
      color: active ? activeColor : inactiveColor,
      fontSize: typeof fontSize === "number" ? `${fontSize}px` : fontSize
    }),
    [active, activeColor, fontSize, inactiveColor]
  );

  return (
    <span
      style={style}
      onClick={handleClick}
      className={cx(
        `
          relative inline
          text-3xl font-semibold
          duration-500 ease-in-out transition-all
        `,
        active ? "text-white" : "text-white/30",
        wordIndex > currentWordIndex && !singleWord ? "blur-[1.5px]" : "blur-none"
      )}>
      {word.word}
    </span>
  );
};
export default memo(LyricWord);
