import { FC, memo, ReactNode } from "react";
import { css, cx } from "@emotion/css";

interface TagProps {
  backgroundColor: string;
  textColor: string;
  text: ReactNode;
  className?: string;
}

const Tag: FC<TagProps> = ({ backgroundColor, textColor, text, className }) => {
  return (
    <div
      className={cx(
        `
          text-[8px] h-3 rounded-sm px-1
          text-center align-middle
          font-semibold opacity-80
          select-none
        `,
        css(`
          background: ${backgroundColor};
          color: ${textColor};
        `),
        !text && "invisible",
        className
      )}>
      {text}
    </div>
  );
};
export default memo(Tag);
