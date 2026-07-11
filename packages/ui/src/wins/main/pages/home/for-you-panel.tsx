import { cx } from "@emotion/css";
import { memo, type FC, useMemo, useEffect, useCallback } from "react";
import { Clock3, Music2, CalendarDays, type LucideIcon, LucideRefreshCw } from "lucide-react";
import { useUser } from "@/common/store/user";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPIRecord } from "@/common/netease/api";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useRequestAutoRun, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import dayjs from "dayjs";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface StatItem {
  label: string;
  Icon: LucideIcon;
  value: number | string;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const ForYouPanel: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const isLoggedIn = user?.isLoggedIn;

  const {
    status,
    fetchData,
    data: { weekRecords, monthRecords } = {}
  } = useRequestStatusWrap(
    useCallback(async () => {
      if (!isLoggedIn)
        return {
          weekRecords: null,
          monthRecords: null
        };
      const weekRecords = await NeteaseAPIRecord.week()
        .then(RendererFormat.weekRecord)
        .catch(() => undefined);
      const monthRecords = await NeteaseAPIRecord.month()
        .then(RendererFormat.monthRecord)
        .catch(() => undefined);
      return {
        weekRecords,
        monthRecords
      };
    }, [isLoggedIn])
  );
  const { reload } = useRequestAutoRun(fetchData, []);

  const dateDisplay = dayjs();
  const statItems: StatItem[] = useMemo(
    () => [
      {
        label: "本周",
        value: (weekRecords?.total ?? "-") + " m",
        Icon: CalendarDays
      },
      {
        label: "今日",
        value: (weekRecords?.today?.duration ?? "-") + " m",
        Icon: Clock3
      },
      {
        label: "歌曲",
        value: (weekRecords?.todayTrackCount ?? "-") + " 首",
        Icon: Music2
      }
    ],
    [weekRecords?.today?.duration, weekRecords?.todayTrackCount, weekRecords?.total]
  );

  // 监听历史变化，实时刷新听歌数据
  const history = useListenable(RendererPlayerHandle.player.history);
  useEffect(() => {
    reload();
  }, [history.count, isLoggedIn, reload]);

  return (
    <aside
      className={cx(
        `
        relative min-h-52 w-full min-w-0 overflow-hidden rounded-xl border border-white/15
        bg-linear-to-br from-white/12 via-white/5 to-primary/50 p-3
        shadow-md backdrop-saturate-150 backdrop-blur-lg
        group lg:h-full
        `,
        className
      )}>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-white/30" />
      <AppError reset={reload} message="听歌数据加载错误" when={status === "error"}>
        <AppLoading tips="听歌数据加载中" loading={status === "loading"}>
          <div className="relative z-10 flex h-full min-h-0 flex-col justify-between gap-4 sm:flex-row sm:gap-6 xl:gap-8 contain-strict">
            {/* title 和 日期 */}
            <section className="flex min-w-0 flex-col justify-between items-start">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                  Listening Footprint
                </p>
                <p className="truncate text-xl font-bold flex items-center gap-2">
                  <span>听歌足迹</span>
                  <span title="刷新">
                    <LucideRefreshCw
                      className="size-4 hover:opacity-50 ease-in-out transition-opacity duration-500 cursor-pointer opacity-0 group-hover:opacity-100 active:scale-98"
                      onClick={reload}
                    />
                  </span>
                </p>
              </div>
              <div className="min-w-0 border-l-2 border-primary/55 pl-3">
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold leading-none tabular-nums sm:text-6xl">
                    {dateDisplay.date().toString().padStart(2, "0")}
                  </span>
                  <span className="mb-1 flex min-w-0 flex-col gap-0.5">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-widest opacity-55">
                      {dateDisplay.month() + 1}月
                    </span>
                    <span className="truncate text-sm font-semibold">
                      {WEEKDAYS[dateDisplay.day()]}
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex max-w-40 items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold">
                  <span className="shrink-0 tabular-nums opacity-55">{dateDisplay.year()}</span>
                  <span className="min-w-0 truncate">
                    {isLoggedIn ? "听歌报告更新中" : "登录后同步报告"}
                  </span>
                </div>
              </div>
            </section>
            {/* 头像和信息 */}
            <section className="flex min-w-0 flex-col items-start justify-between sm:items-end">
              <div className="flex min-w-0 shrink-0 flex-col items-start sm:items-end">
                <div className="mt-0.5 flex max-w-full shrink-0 items-center gap-3">
                  {!!user && (
                    <NeteaseImage
                      className="size-10 rounded-full border cursor-pointer hover:scale-105 ease-in-out duration-300 transition-transform"
                      shadow="base"
                      cacheLazy={false}
                      image={NeteaseNetworkImage.fromUserAvatar(user)}
                      onClick={async () => {
                        await RendererWindow.display.reactReadyAwait();
                        RendererIPCMessageBus.display.deliver({ type: "settings" });
                      }}
                      cache
                    />
                  )}
                  <span className="min-w-0 truncate text-xl font-bold sm:text-2xl">
                    {user ? user.profile.nickname : "发现音乐"}
                  </span>
                </div>
                {!!user && (
                  <span className="font-semibold tracking-wide">
                    {RendererFormat.yearsAndDays(user?.profile.createTime)}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex flex-col flex-1 justify-end py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest opacity-45">
                  Month Total
                </p>
                <strong className="mt-1 block truncate text-2xl font-bold leading-none tabular-nums sm:text-right">
                  {monthRecords?.total ?? "-"} m
                </strong>
              </div>
              <div className="grid w-full shrink-0 grid-cols-3 gap-1.5 sm:w-auto">
                {statItems.map(({ Icon, label, value }) => (
                  <div key={label} className="min-w-0 rounded-md bg-white/10 px-2 py-1.5">
                    <div className="flex items-center gap-1 opacity-55">
                      <Icon className="size-3 shrink-0" />
                      <span className="truncate text-[9px] font-semibold">{label}</span>
                    </div>
                    <span className="mt-0.5 block truncate text-[11px] font-semibold tabular-nums">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </AppLoading>
      </AppError>
    </aside>
  );
};

export default memo(ForYouPanel);
