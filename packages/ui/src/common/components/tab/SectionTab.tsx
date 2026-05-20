import { FC, memo, ReactNode } from "react";
import { cx } from "@emotion/css";

interface TabProps {
  data: (string | ReactNode)[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
  className?: string;
  mode?: "more-theme" | "less-theme";
}

const SectionTab: FC<TabProps> = ({
  data,
  activeIndex,
  onChange,
  className,
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
          `border-(--theme-color-main) bg-(--theme-color-main)/10
          text-(--theme-color-main)`,
        className
      )}>
      {data.map((item, index) => (
        <span
          key={index}
          className={cx(
            "cursor-pointer hover:bg-(--theme-color-main) hover:text-(--text-color-on-main) hover:rounded-full px-1.5 py-px transition-all duration-300 ease-in-out",
            activeIndex === index
              ? mode === "less-theme"
                ? "bg-(--text-color-on-main) text-(--theme-color-main) rounded-full"
                : "bg-(--theme-color-main) text-(--text-color-on-main) rounded-full"
              : "bg-transparent"
          )}
          onClick={() => onChange?.(index)}>
          {item}
        </span>
      ))}
    </div>
  );
};

export default memo(SectionTab);
