import { useMemo, useState, useEffect, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseAPIRecord } from "@/common/netease/api";
import dayjs from "dayjs";
import type { RendererFormat } from "@/common/lib/format";

type WeekRecord = ReturnType<typeof RendererFormat.weekRecord>;

export type ListeningWeekDay = {
  period: string;
  duration?: number;
  previousWeek: boolean;
};

interface PreviousWeek {
  userId: number;
  endTime: number;
  failed: boolean;
  loading: boolean;
  details: WeekRecord["details"];
}

export function useListeningWeekTrend({
  date,
  week,
  active = true
}: {
  date: string;
  active?: boolean;
  week: Nullable<WeekRecord>;
}) {
  const user = useUser();
  const userId = user?.isLoggedIn ? user.userId : undefined;
  const today = dayjs(date).startOf("day");
  // 网易云自然周从周日开始，不依赖 dayjs 当前语言的 startOf("week") 设置。
  const weekStart = today.subtract(today.day(), "day");
  const previousWeekEnd = weekStart.subtract(1, "day").valueOf();
  const needsPreviousWeek = active && userId !== undefined && week !== null && today.day() < 6;
  const [history, setHistory] = useState<Nullable<PreviousWeek>>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const data = history?.userId === userId && history?.endTime === previousWeekEnd ? history : null;

  useEffect(() => {
    if (userId === undefined) {
      setHistory(null);
      return;
    }
    if (!needsPreviousWeek) return;
    const controller = new AbortController();
    const { signal } = controller;
    const existingDetails = (previous: Nullable<PreviousWeek>) =>
      previous?.userId === userId && previous.endTime === previousWeekEnd ? previous.details : [];
    setHistory((previous) => ({
      userId,
      endTime: previousWeekEnd,
      loading: true,
      failed: false,
      details: existingDetails(previous)
    }));

    NeteaseAPIRecord.report("week", previousWeekEnd, signal).then(
      (response) => {
        if (signal.aborted) return;
        setHistory({
          userId,
          endTime: previousWeekEnd,
          loading: false,
          failed: false,
          details: response.data.listenTimeDistributionBlock.durationDetails
        });
      },
      () => {
        if (signal.aborted) return;
        setHistory((previous) => ({
          userId,
          endTime: previousWeekEnd,
          loading: false,
          failed: true,
          details: existingDetails(previous)
        }));
      }
    );

    return () => controller.abort();
  }, [needsPreviousWeek, previousWeekEnd, reloadCount, userId]);

  const details = useMemo<ListeningWeekDay[]>(() => {
    if (!active || userId === undefined || !week) return [];
    const currentDay = dayjs(date).startOf("day");
    const start = currentDay.subtract(currentDay.day(), "day");
    const records = new Map<string, WeekRecord["details"][number]>();
    // 当前周的数据覆盖历史响应中的同一天，缺失日期保留未知值，不补成 0。
    for (const item of [...(data?.details ?? []), ...week.details]) {
      if (!item.period) continue;
      const day = dayjs(item.period);
      if (day.isValid()) records.set(day.format("YYYY-MM-DD"), item);
    }
    return Array.from({ length: 7 }, (_, index) => {
      const day = currentDay.subtract(6 - index, "day");
      const period = day.format("YYYY-MM-DD");
      return {
        period,
        duration: records.get(period)?.duration,
        previousWeek: day.isBefore(start)
      };
    });
  }, [active, data?.details, date, userId, week]);

  return {
    details,
    loading: needsPreviousWeek && (!data || data.loading),
    failed: needsPreviousWeek && (data?.failed ?? false),
    reload
  };
}
