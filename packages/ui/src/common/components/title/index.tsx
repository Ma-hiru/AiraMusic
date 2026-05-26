import { type FC, memo, type ReactNode } from "react";
import { cx } from "@emotion/css";

interface TitleProps {
  title: ReactNode;
  className?: string;
  slot?: ReactNode;
}

const AppTitle: FC<TitleProps> = ({ title, slot, className }) => {
  return (
    <div
      className={cx(
        `
          w-full truncate font-bold text-[28px] text-(--text-color-on-main)
          flex justify-between items-center select-none
       `,
        className
      )}>
      <span>{title}</span>
      <span>{slot}</span>
    </div>
  );
};

export default memo(AppTitle);
