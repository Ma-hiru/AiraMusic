import { useState } from "react";
import { cx } from "@emotion/css";
import { formatListeningDuration } from "@/common/hooks/use-listening-footprint";
import dayjs from "dayjs";
import Tooltip from "@/common/components/display/tooltip";

type DurationDetail = { period?: string; duration?: number };

function dateLabel(detail: DurationDetail, index: number) {
  const date = detail.period ? dayjs(detail.period) : null;
  return date?.isValid() ? date.format("M月D日") : (detail.period ?? `第${index + 1}天`);
}

const DailyChart = ({
  onSelectDay,
  details,
  selectedDay,
  variant = "drawer"
}: {
  details: DurationDetail[];
  variant?: "page" | "drawer";
  selectedDay: Nullable<string>;
  onSelectDay: NormalFunc<[day: string]>;
}) => {
  const selected = details.findIndex(
    (item) => item.period && dayjs(item.period).format("YYYY-MM-DD") === selectedDay
  );
  const [hovered, setHovered] = useState<Nullable<number>>(null);
  const activeIndex = Math.min(
    hovered ?? (selected >= 0 ? selected : details.length - 1),
    details.length - 1
  );
  const detail = details[activeIndex];
  const max = Math.max(1, ...details.map((item) => item.duration ?? 0));

  return (
    <figure
      className={cx("flex shrink-0 flex-col gap-1", variant === "page" ? "h-[150px]" : "h-[110px]")}
      aria-label="每日收听时长">
      <figcaption className="flex shrink-0 items-baseline justify-between gap-3 text-[10px]">
        <span className="opacity-50">每日收听</span>
        {detail && (
          <span className="tabular-nums opacity-70" role="status" aria-label="选中日期收听时长">
            {dateLabel(detail, activeIndex)}
            <span className="ml-2">{formatListeningDuration(detail.duration)}</span>
          </span>
        )}
      </figcaption>
      {details.length > 0 ? (
        <ol
          className="grid min-h-0 flex-1 auto-cols-fr grid-flow-col gap-1"
          onMouseLeave={() => setHovered(null)}>
          {details.map((item, index) => {
            const label = dateLabel(item, index);
            const value = formatListeningDuration(item.duration);
            const date = item.period ? dayjs(item.period) : null;
            const showLabel =
              details.length <= 10 ||
              index === 0 ||
              index === details.length - 1 ||
              (index + 1) % 5 === 0;
            return (
              <li key={`${item.period}-${index}`} className="min-h-0 min-w-0">
                <Tooltip
                  className="h-full w-full min-w-0"
                  tooltipLabel={`${label}收听时长`}
                  placement={
                    index < details.length / 4
                      ? "right"
                      : index > (details.length * 3) / 4
                        ? "left"
                        : "top"
                  }
                  content={
                    <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/85 px-3 py-2 text-white shadow-lg backdrop-blur-lg">
                      <p className="text-[10px] opacity-65">{label}</p>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">{value}</p>
                    </div>
                  }
                  portal>
                  <button
                    className="flex h-full w-full min-w-0 cursor-pointer flex-col gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    type="button"
                    aria-label={`${label}，${value}`}
                    aria-pressed={selected === index}
                    onBlur={() => setHovered(null)}
                    onFocus={() => setHovered(index)}
                    onMouseEnter={() => setHovered(index)}
                    onClick={() => {
                      if (date?.isValid()) onSelectDay(date.format("YYYY-MM-DD"));
                    }}>
                    <span className="relative block min-h-0 w-full flex-1" aria-hidden="true">
                      <span
                        className={cx(
                          "absolute bottom-0 left-1/2 w-2.5 max-w-[60%] -translate-x-1/2 rounded-t-sm transition-colors duration-150",
                          activeIndex === index ? "bg-white/85" : "bg-white/40"
                        )}
                        style={{ height: `${Math.max(0, ((item.duration ?? 0) / max) * 100)}%` }}
                      />
                    </span>
                    <span
                      className="h-3 w-full truncate text-center text-[9px] tabular-nums opacity-45"
                      aria-hidden="true">
                      {showLabel ? (date?.isValid() ? date.format("M.D") : index + 1) : " "}
                    </span>
                  </button>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-xs opacity-45">
          暂无每日收听数据
        </div>
      )}
    </figure>
  );
};

export default DailyChart;
