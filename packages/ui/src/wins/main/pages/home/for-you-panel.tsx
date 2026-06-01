import { type FC, memo, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, type LucideIcon, Music2 } from "lucide-react";
import { useUser } from "@/common/store/user";
import { NeteaseAPIRecord } from "@/common/netease/api";
import { RendererFormat } from "@/common/lib/format";
import { Log } from "@/common/lib/log";
import NeteaseImage from "@/common/components/image/netease-image";
import { NeteaseNetworkImage } from "@/common/netease/models";
import dayjs from "dayjs";

type WeekRecord = ReturnType<typeof RendererFormat.weekRecord>;
type MonthRecord = ReturnType<typeof RendererFormat.monthRecord>;

interface StatItem {
  label: string;
  value: number | string;
  Icon: LucideIcon;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const ForYouPanel: FC<object> = () => {
  const user = useUser();
  const isLoggedIn = user?.isLoggedIn;
  const [weekRecords, setWeekRecords] = useState<Nullable<WeekRecord>>(null);
  const [monthRecords, setMonthRecords] = useState<Nullable<MonthRecord>>(null);
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

  useEffect(() => {
    if (!isLoggedIn) {
      setWeekRecords(null);
      setMonthRecords(null);
      return;
    }

    let cancel = false;
    void Promise.allSettled([
      NeteaseAPIRecord.week().then(RendererFormat.weekRecord),
      NeteaseAPIRecord.month().then(RendererFormat.monthRecord)
    ]).then(([week, month]) => {
      if (cancel) return;

      if (week.status === "fulfilled") {
        setWeekRecords(week.value);
      } else {
        Log.info("ForYouPanel.week", week.reason);
        setWeekRecords(null);
      }

      if (month.status === "fulfilled") {
        setMonthRecords(month.value);
      } else {
        Log.info("ForYouPanel.month", month.reason);
        setMonthRecords(null);
      }
    });

    return () => {
      cancel = true;
    };
  }, [isLoggedIn]);

  return (
    <aside
      className="
        relative h-full w-full overflow-hidden rounded-xl border border-white/15
        bg-linear-to-br from-white/12 via-white/5 to-(--theme-color-main)/12 p-3
        text-(--text-color-on-main) shadow-md backdrop-blur-2xl
      ">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-white/10" />
      <div className="relative z-10 flex h-full min-h-0 flex-row justify-between gap-12">
        <section className="flex min-w-0 flex-col justify-between items-start">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-widest opacity-50">
              Listening Footprint
            </p>
          </div>
          <div className="min-w-0 border-l-2 border-(--theme-color-main)/55 pl-3">
            <div className="flex items-end gap-2">
              <span className="text-6xl font-black leading-none tabular-nums">
                {dateDisplay.date().toString().padStart(2, "0")}
              </span>
              <span className="mb-1 flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[11px] font-black uppercase tracking-widest opacity-55">
                  {dateDisplay.month() + 1}月
                </span>
                <span className="truncate text-sm font-black">{WEEKDAYS[dateDisplay.day()]}</span>
              </span>
            </div>
            <div className="mt-2 flex max-w-40 items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-[10px] font-black">
              <span className="shrink-0 tabular-nums opacity-55">{dateDisplay.year()}</span>
              <span className="min-w-0 truncate">
                {isLoggedIn ? "听歌报告更新中" : "登录后同步报告"}
              </span>
            </div>
          </div>
        </section>
        <section className="flex min-w-0 flex-col justify-between items-end">
          <div className="flex flex-col items-end shrink-0">
            <div className="mt-0.5 flex items-center gap-3 shrink-0">
              <NeteaseImage
                cache
                className="size-10 rounded-full border"
                cacheLazy={false}
                shadow="base"
                image={NeteaseNetworkImage.fromUserAvatar(user)}
              />
              <span className="truncate text-2xl font-black">
                {isLoggedIn ? user.profile.nickname : "发现音乐"}
              </span>
            </div>
            {!!user && (
              <span className="font-black tracking-wide">
                {RendererFormat.yearsAndDays(user?.profile.createTime)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex flex-col flex-1 justify-end py-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-45">
              Month Total
            </p>
            <strong className="mt-1 block truncate text-2xl text-right font-black leading-none tabular-nums">
              {monthRecords?.total ?? "-"} m
            </strong>
          </div>
          <div className="grid grid-cols-3 gap-1.5 shrink-0">
            {statItems.map(({ label, value, Icon }) => (
              <div key={label} className="min-w-0 rounded-md bg-white/10 px-2 py-1.5">
                <div className="flex items-center gap-1 opacity-55">
                  <Icon className="size-3 shrink-0" />
                  <span className="truncate text-[9px] font-black">{label}</span>
                </div>
                <span className="mt-0.5 block truncate text-[11px] font-black tabular-nums">
                  {value}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};

export default memo(ForYouPanel);
