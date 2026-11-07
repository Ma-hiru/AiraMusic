import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIRecord } from "@/common/netease/api";

export type ListeningPeriod = "week" | "month" | "today";

interface ListeningStats {
  userId: number;
  failed: boolean;
  loading: boolean;
  week: Nullable<ReturnType<typeof RendererFormat.weekRecord>>;
  month: Nullable<ReturnType<typeof RendererFormat.monthRecord>>;
}

export function formatListeningDuration(minutes: Optional<number>): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}分钟`;
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  return `${hours}小时${remainder ? `${remainder}分` : ""}`;
}

export function useListeningFootprint(revision = 0, active = true) {
  const user = useUser();
  const userId = user?.isLoggedIn ? user.userId : undefined;
  const loggedIn = userId !== undefined;
  const [stats, setStats] = useState<Nullable<ListeningStats>>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  const data = stats?.userId === userId ? stats : null;

  useEffect(() => {
    if (userId === undefined) {
      setStats(null);
      return;
    }
    if (!active) return;
    const controller = new AbortController();
    const { signal } = controller;
    setStats((previous) => ({
      userId,
      loading: true,
      failed: false,
      week: previous?.userId === userId ? previous.week : null,
      month: previous?.userId === userId ? previous.month : null
    }));

    Promise.allSettled([
      NeteaseAPIRecord.week(signal).then(RendererFormat.weekRecord),
      NeteaseAPIRecord.month(signal).then(RendererFormat.monthRecord)
    ]).then(([week, month]) => {
      if (signal.aborted) return;
      setStats({
        userId,
        loading: false,
        failed: week.status === "rejected" || month.status === "rejected",
        week: week.status === "fulfilled" ? week.value : null,
        month: month.status === "fulfilled" ? month.value : null
      });
    });

    return () => controller.abort();
  }, [active, reloadCount, revision, userId]);

  return {
    week: data?.week ?? null,
    month: data?.month ?? null,
    loading: active && loggedIn && (!data || data.loading),
    failed: data?.failed ?? false,
    loggedIn,
    reload
  };
}
