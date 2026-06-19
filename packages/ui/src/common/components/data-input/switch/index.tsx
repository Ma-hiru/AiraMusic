import { type FC, memo, type ReactNode } from "react";
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
        flex justify-center items-center relative
        font-bold text-[10px] text-center
        p-0.5 cursor-pointer
        transition-all duration-300 ease-in-out
        group hover:text-(--theme-color-main)
        `,
        className
      )}
      onClick={onClick}>
      {label}
      <span
        className={cx(
          "absolute w-full h-0.5 bottom-0 bg-(--theme-color-main) hidden",
          checked && "inline-block"
        )}
      />
    </div>
  );
};
export default memo(Switch);
