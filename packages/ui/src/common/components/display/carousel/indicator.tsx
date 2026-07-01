import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { iter } from "@/common/utils/iter";

interface IndicatorProps {
  length: number;
  title?: string;
  activeIdx: number;
  showDot?: boolean;
  onDotClick?: NormalFunc<[idx: number]>;
}

const Indicator: FC<IndicatorProps> = ({
  onDotClick,
  title,
  length,
  activeIdx,
  showDot = true
}) => {
  return (
    <section className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-linear-to-t from-black/60 via-black/20 to-transparent px-4 pb-3 pt-14 pointer-events-none">
      <p className="truncate text-sm font-semibold">{title}</p>
      {showDot && (
        <div className="flex shrink-0 gap-1 pointer-events-auto">
          {iter(length).map((_, i) => {
            return (
              <button
                key={i}
                className={cx(
                  `
                  h-2.5 cursor-pointer rounded-full transition-all duration-300 ease-in-out
                  active:scale-90
                `,
                  i === activeIdx ? "w-6 bg-white" : "w-2.5 bg-white/35 hover:bg-white/70"
                )}
                title={`切换到第 ${i + 1} 张`}
                onClick={() => onDotClick?.(i)}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};

export default memo(Indicator);
