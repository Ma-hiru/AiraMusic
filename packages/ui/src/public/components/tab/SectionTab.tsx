import { FC, memo, ReactNode } from "react";
import { cx } from "@emotion/css";
import AppUI from "@mahiru/ui/public/player/ui";

interface TabProps {
  data: (string | ReactNode)[];
  activeIndex: number;
  onChange?: NormalFunc<[index: number]>;
  className?: string;
}
AppUI;
const SectionTab: FC<TabProps> = ({ data, activeIndex, onChange, className }) => {
  return (
    <div
      className={cx(
        "inline-block space-x-0.5 border-2 border-(--theme-color-main) rounded-full px-0.5 py-0.5 font-medium text-[10px] md:text-sm lg:text-base bg-(--text-color-on-main)",
        className
      )}>
      {data.map((item, index) => (
        <span
          key={index}
          className={cx(
            "cursor-pointer hover:bg-(--theme-color-main) hover:text-(--text-color-on-main) hover:rounded-full px-2 py-0.5 transition-all duration-300 ease-in-out",
            activeIndex === index
              ? "bg-(--theme-color-main) text-(--text-color-on-main) rounded-full px-2 py-0.5 font-bold"
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
