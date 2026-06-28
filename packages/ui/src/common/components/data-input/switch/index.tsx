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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      className={cx(
        `
        flex justify-center items-center relative
        font-bold text-[10px] text-center
        border-0 bg-transparent p-0.5 cursor-pointer
        outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        transition-all duration-300 ease-in-out
        group hover:text-primary
        `,
        className
      )}
      onClick={onClick}>
      {label}
      <span
        className={cx(
          "absolute w-full h-0.5 bottom-0 bg-primary hidden",
          checked && "inline-block"
        )}
      />
    </button>
  );
};

export default memo(Switch);
