import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { RendererFormat } from "@/common/lib/format";
import type { CacheStoreCategories } from "@/types/cache";

interface DonutChartProps {
  className?: string;
  cacheStoreSizes: Nullable<CacheStoreCategories>;
}

const DonutChart: FC<DonutChartProps> = ({ className, cacheStoreSizes }) => {
  const cacheSizeStats = useMemo(() => {
    const items = [
      {
        key: "image",
        label: "图片",
        value: Math.max(0, cacheStoreSizes?.image ?? 0),
        color: "#38bdf8",
        swatchClassName: "bg-sky-400"
      },
      {
        key: "audio",
        label: "音频",
        value: Math.max(0, cacheStoreSizes?.audio ?? 0),
        color: "#fb7185",
        swatchClassName: "bg-rose-400"
      },
      {
        key: "video",
        label: "视频",
        value: Math.max(0, cacheStoreSizes?.video ?? 0),
        color: "#fbbf24",
        swatchClassName: "bg-amber-400"
      },
      {
        key: "other",
        label: "其它",
        value: Math.max(0, cacheStoreSizes?.other ?? 0),
        color: "#a78bfa",
        swatchClassName: "bg-violet-400"
      }
    ];

    let cursor = 0;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const itemsWithPercent = items.map((item) => {
      const percent = total > 0 ? (item.value / total) * 100 : 0;
      const from = cursor;
      cursor += percent;

      return {
        ...item,
        percent,
        from,
        to: cursor
      };
    });

    const gradient =
      total > 0
        ? `conic-gradient(${itemsWithPercent
            .filter((item) => item.value > 0)
            .map((item) => `${item.color} ${item.from}% ${item.to}%`)
            .join(", ")})`
        : "conic-gradient(rgba(255,255,255,0.18) 0 100%)";

    return {
      total,
      items: itemsWithPercent,
      gradient
    };
  }, [cacheStoreSizes]);
  return (
    <div className={cx("rounded-md border border-white/15 p-3", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto flex size-32 shrink-0 items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: cacheSizeStats.gradient,
              mask: "radial-gradient(transparent 0 55%, #000 56%)",
              WebkitMask: "radial-gradient(transparent 0 55%, #000 56%)"
            }}
          />
          <div className="absolute inset-5.5 rounded-full border border-white/10 bg-white/5" />
          <div className="relative flex flex-col items-center">
            <span className="text-[10px] font-bold opacity-60">合计</span>
            <span className="text-sm font-bold">{RendererFormat.size(cacheSizeStats.total)}</span>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2">
          {cacheSizeStats.items.map((item) => (
            <div key={item.key} className="rounded-md border border-white/10 px-2 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cx("size-2.5 shrink-0 rounded-full", item.swatchClassName)} />
                  <span className="truncate text-[12px] font-semibold">{item.label}</span>
                </div>
                <span className="shrink-0 text-[10px] font-bold opacity-60">
                  {item.percent.toFixed(item.percent > 0 && item.percent < 1 ? 1 : 0)}%
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-semibold opacity-70">
                {RendererFormat.size(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default memo(DonutChart);
