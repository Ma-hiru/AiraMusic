import { FC, memo, ReactNode } from "react";
import { cx } from "@emotion/css";

interface SwitchProps {
  className?: string;
  label?: ReactNode;
  checked: boolean;
  onClick: NormalFunc;
}

const Switch: FC<SwitchProps> = ({ checked, onClick, className, label }) => {
  return (
    <div
      className={cx(
        `
        flex justify-center items-center
        font-bold text-[10px] text-center
        px-2 py-0.5 rounded-full cursor-pointer
        hover:text-(--text-color-on-main) hover:bg-(--theme-color-main)
        transition-all duration-300 ease-in-out`,
        checked
          ? "text-(--text-color-on-main) bg-(--theme-color-main) font-bold"
          : "text-(--theme-color-main)",
        className
      )}
      onClick={onClick}>
      {label}
    </div>
  );
};
export default memo(Switch);
