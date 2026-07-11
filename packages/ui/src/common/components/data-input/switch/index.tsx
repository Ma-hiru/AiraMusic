import { cx } from "@emotion/css";
import { memo, type FC, type ReactNode } from "react";

interface SwitchProps {
  checked?: boolean;
  label?: ReactNode;
  className?: string;
  underlineClassName?: string;
  onClick?: NormalFunc;
  onChange?: NormalFunc<[checked: boolean]>;
}

const Switch: FC<SwitchProps> = ({
  className,
  onClick,
  onChange,
  label,
  checked,
  underlineClassName
}) => {
  return (
    <button
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
      role="switch"
      type="button"
      aria-checked={checked}
      aria-label={typeof label === "string" ? label : undefined}
      onClick={() => {
        onClick?.();
        onChange?.(!checked);
      }}>
      {label}
      <span
        className={cx(
          "absolute w-full h-0.5 bottom-0 bg-primary hidden",
          checked && "inline-block",
          underlineClassName
        )}
      />
    </button>
  );
};

export default memo(Switch);
