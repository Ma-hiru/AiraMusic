import { cx } from "@emotion/css";
import { memo, type FC, type ReactNode } from "react";

interface TagProps {
  text: ReactNode;
  className?: string;
}

const Tag: FC<TagProps> = ({ className, text }) => {
  return (
    <div
      className={cx(
        `
          text-[8px] rounded-sm px-1
          text-center align-middle
          font-semibold opacity-80
          bg-primary-text text-primary
          leading-normal
        `,
        !text && "invisible",
        className
      )}>
      {text}
    </div>
  );
};

export default memo(Tag);
