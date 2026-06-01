import { type FC, memo } from "react";
import { cx } from "@emotion/css";

interface IndicatorProps {
  title?: string;
  showDot?: boolean;
  length: number;
  activeIdx: number;
  onDotClick?: NormalFunc<[idx: number]>;
}

const Indicator: FC<IndicatorProps> = ({
  title,
  onDotClick,
  activeIdx,
  showDot = true,
  length
}) => {
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-linear-to-t from-(--theme-color-main)/60 via-(--theme-color-main)/20 to-transparent px-4 pb-3 pt-14">
      <p className="truncate text-sm font-black text-(--text-color-on-main)">{title}</p>
      {showDot && (
        <div className="flex shrink-0 gap-1">
          {new Array(length).map((_, i) => (
            <button
              key={i}
              title={`切换到第 ${i + 1} 张`}
              onClick={() => onDotClick?.(i)}
              className={cx(
                `
                  h-2.5 cursor-pointer rounded-full transition-all duration-300 ease-in-out
                  active:scale-90
                `,
                i === activeIdx
                  ? "w-6 bg-(--text-color-on-main)"
                  : "w-2.5 bg-(--text-color-on-main)/35 hover:bg-(--text-color-on-main)/70"
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default memo(Indicator);
