import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { AudioLines, RotateCwSquare } from "lucide-react";
import { useListeningFootprint } from "@/common/hooks/use-listening-footprint";
import dayjs from "dayjs";

interface PlayListStatsProps {
  active?: boolean;
  className?: string;
  statsRevision?: number;
}

function minutes(value: Optional<number>) {
  return value != null && Number.isFinite(value) ? Number(value.toFixed(1)) : null;
}

const PlayListStats: FC<PlayListStatsProps> = ({ className, active = true, statsRevision = 0 }) => {
  const { week, month, failed, reload, loading, loggedIn } = useListeningFootprint(
    statsRevision,
    active
  );
  const details = week?.details.slice(-7) ?? [];
  const maxDuration = Math.max(1, ...details.map((detail) => minutes(detail.duration) ?? 0));
  const values = [
    { label: "今日", value: minutes(week?.today?.duration) },
    { label: "本周", value: minutes(week?.total) },
    { label: "本月", value: minutes(month?.total) }
  ];

  return (
    <aside className={cx("@container min-w-0", className)} aria-busy={loading}>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AudioLines className="size-4 shrink-0" />
          <h2 className="text-sm font-semibold">听歌足迹</h2>
        </div>
        {loggedIn && (
          <button
            className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-50 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-30"
            type="button"
            aria-label="刷新听歌统计"
            disabled={!active || loading}
            onClick={reload}>
            <RotateCwSquare
              className={cx("size-4.5", loading && "animate-spin motion-reduce:animate-none")}
            />
          </button>
        )}
      </header>
      {!loggedIn ? (
        <p className="text-xs opacity-50">登录后查看听歌足迹</p>
      ) : (
        <>
          <div className="grid gap-5 @[32rem]:grid-cols-2 @[32rem]:items-end @[32rem]:gap-8">
            <dl className="grid grid-cols-1 gap-3 @[32rem]:grid-cols-3">
              {values.map(({ label, value }) => (
                <div
                  key={label}
                  className="flex min-w-0 items-baseline justify-between gap-2 @[32rem]:block">
                  <dt className="text-[11px] opacity-80">{label}</dt>
                  <dd className="mt-1 truncate tabular-nums">
                    <span className="text-lg font-semibold">{value ?? "—"}</span>
                    {value !== null && <span className="ml-1 text-[10px] opacity-80">分钟</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <figure className="min-w-0" aria-label="本周收听分布">
              <figcaption className="mb-2 flex items-center justify-between text-[10px] opacity-80">
                <span>本周收听分布</span>
              </figcaption>
              {details.length > 0 ? (
                <ol className="grid auto-cols-fr grid-flow-col gap-2" aria-label="本周每日收听时长">
                  {details.map((detail, index) => {
                    const duration = minutes(detail.duration);
                    const date = detail.period ? dayjs(detail.period) : null;
                    const label = date?.isValid() ? date.format("M.D") : (detail.period ?? "—");
                    return (
                      <li
                        key={`${detail.period}-${index}`}
                        className="min-w-0"
                        title={`${detail.period ?? "当日"}：${duration ?? "—"}分钟`}
                        aria-label={`${detail.period ?? "当日"}，${duration ?? "—"}分钟`}>
                        <div className="flex h-14 items-end justify-center" aria-hidden="true">
                          <div
                            className="w-full max-w-5 rounded-t-sm bg-white/80"
                            style={{ height: `${((duration ?? 0) / maxDuration) * 100}%` }}
                          />
                        </div>
                        <p className="mt-2 truncate text-center text-[10px] tabular-nums opacity-45">
                          {label}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="flex min-h-14 items-center text-xs opacity-45">
                  {loading ? "正在同步听歌数据" : week ? "本周还没有收听记录" : "暂无本周数据"}
                </p>
              )}
            </figure>
          </div>
          {failed && (
            <p className="mt-3 text-[11px] opacity-50" role="status">
              {week || month ? "部分听歌数据暂不可用" : "听歌数据暂不可用"}
            </p>
          )}
        </>
      )}
    </aside>
  );
};

export default memo(PlayListStats);
