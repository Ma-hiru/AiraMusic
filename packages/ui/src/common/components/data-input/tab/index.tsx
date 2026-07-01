import { cx } from "@emotion/css";
import { memo, type FC, type ReactNode } from "react";

interface TabProps {
  className?: string;
  activeIndex: number;
  data: (string | ReactNode)[];
  mode?: "less-theme" | "more-theme";
  itemClassName?: string | NormalFunc<[active: boolean], Undefinable<string | boolean>>;
  onChange?: NormalFunc<[index: number]>;
}

const SectionTab: FC<TabProps> = ({
  className,
  onChange,
  data,
  activeIndex,
  itemClassName,
  mode = "more-theme"
}) => {
  return (
    <div
      className={cx(
        `
           space-x-0.5 border-2
           rounded-full px-px py-px font-semibold
           inline-flex items-center justify-center gap-1
        `,
        mode === "more-theme" &&
          `border-primary bg-primary/10
          text-primary`,
        className
      )}>
      {data.map((item, index) => {
        const active = activeIndex === index;
        return (
          <span
            key={index}
            className={cx(
              "cursor-pointer hover:bg-primary hover:text-primary-text hover:rounded-full px-1.5 py-px transition-all duration-300 ease-in-out",
              active
                ? mode === "less-theme"
                  ? "bg-primary-text text-primary rounded-full"
                  : "bg-primary text-primary-text rounded-full"
                : "bg-transparent",
              typeof itemClassName === "function" ? itemClassName(active) : itemClassName
            )}
            onClick={() => onChange?.(index)}>
            {item}
          </span>
        );
      })}
    </div>
  );
};

export default memo(SectionTab);
