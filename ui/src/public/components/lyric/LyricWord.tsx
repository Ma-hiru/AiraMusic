import { FC, memo, useCallback } from "react";
import { cx } from "@emotion/css";

interface LyricWordProps {
  word: LyricWord;
  active: boolean;
  highlight: boolean;
  single?: boolean;
  onClick?: NormalFunc<[startTime: number]>;
}

const LyricWord: FC<LyricWordProps> = ({ word, active, highlight, onClick, single }) => {
  const handleClick = useCallback(() => {
    onClick?.(word.startTime);
  }, [onClick, word.startTime]);

  return (
    <span
      onClick={handleClick}
      className={cx(
        "font-semibold inline duration-300 ease-in-out transition-all text-3xl relative",
        active && highlight ? "text-white" : "text-white/30",
        !single && active && highlight && "text-[32px]"
      )}>
      {word.word}
    </span>
  );
};
export default memo(LyricWord);
