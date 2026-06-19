import { type FC, memo, type ReactNode } from "react";
import { cx } from "@emotion/css";

interface TagProps {
  text: ReactNode;
  className?: string;
}

const Tag: FC<TagProps> = ({ text, className }) => {
  return (
    <div
      className={cx(
        `
          text-[8px] rounded-sm px-1
          text-center align-middle
          font-semibold opacity-80
          select-none
          bg-(--text-color-on-main) text-(--theme-color-main)
        `,
        !text && "invisible",
        className
      )}>
      {text}
    </div>
  );
};

export default memo(Tag);
