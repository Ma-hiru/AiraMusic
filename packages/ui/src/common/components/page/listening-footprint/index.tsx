import { cx } from "@emotion/css";
import { RotateCwSquare } from "lucide-react";
import {
  useId,
  useMemo,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useTrackContextMenu } from "@/common/hooks/use-track-context-menu";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useListeningWeekTrend } from "@/common/hooks/use-listening-week-trend";
import { openTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import {
  type ListeningPeriod,
  useListeningFootprint,
  formatListeningDuration
} from "@/common/hooks/use-listening-footprint";
import dayjs from "dayjs";
import RendererImageConstants from "@/common/constants/image";
import IconButton from "@/common/components/data-input/icon-button";
import TrackList, { type TrackListClickFunc } from "@/common/components/display/track_list";
import type { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";

import DailyChart from "./daily-chart";
import useTodayTracks from "./use-today-tracks";
import useRankedTracks from "./use-ranked-tracks";

export type ListeningFootprintScope = { day?: string; period: ListeningPeriod };

export type ListeningFootprintActions = { refresh: NormalFunc };

export type ListeningFootprintProps = {
  active?: boolean;
  initialDay?: string;
  activeTrackID?: number;
  historyRevision?: number;
  onPlay: TrackListClickFunc;
  variant?: "page" | "drawer";
  initialPeriod?: ListeningPeriod;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  actionsRef?: Ref<ListeningFootprintActions>;
  historyRecords: readonly NeteaseHistoryRecord[];
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  onTracksLoaded?: NormalFunc<[tracks: NeteaseTrackRecord[]]>;
  onScopeChange?: NormalFunc<[scope: ListeningFootprintScope]>;
};

const EMPTY_TRACKS: NeteaseTrackRecord[] = [];

const periods: { label: string; listTitle: string; value: ListeningPeriod }[] = [
  { value: "today", label: "今日", listTitle: "今日听过的歌曲" },
  { value: "week", label: "本周", listTitle: "本周播放排行" },
  { value: "month", label: "本月", listTitle: "本月播放排行" }
];

const ListeningFootprint = ({
  activeTrackID,
  addToPlaylistLast,
  addToPlaylistNext,
  openComment,
  onPlay,
  onClickAlbum,
  onClickArtist,
  onScopeChange,
  onTracksLoaded,
  actionsRef,
  initialDay,
  active = true,
  historyRecords,
  variant = "drawer",
  historyRevision = 0,
  initialPeriod = "today"
}: ListeningFootprintProps) => {
  const [period, setPeriod] = useState(initialPeriod);
  const [selectedDay, setSelectedDay] = useState<Nullable<string>>(() =>
    initialDay && dayjs(initialDay).isValid() ? dayjs(initialDay).format("YYYY-MM-DD") : null
  );
  const [refreshRevision, setRefreshRevision] = useState(0);
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const revision = historyRevision + refreshRevision;
  const bumpRevision = useCallback(() => setRefreshRevision((value) => value + 1), []);
  useEffect(() => {
    if (!active) return;
    const updateDate = (nextDate: string) => {
      if (period === "week") {
        const previousEnd = dayjs(date);
        const previousStart = previousEnd.subtract(6, "day");
        const nextStart = dayjs(nextDate).subtract(6, "day");
        setSelectedDay((selected) => {
          if (!selected) return selected;
          const day = dayjs(selected);
          // 只重置从当前滚动窗口滑出的选择，保留外部传入的其他历史日期。
          return !day.isBefore(previousStart) &&
            !day.isAfter(previousEnd) &&
            day.isBefore(nextStart)
            ? null
            : selected;
        });
      }
      setDate(nextDate);
      bumpRevision();
    };
    const currentDate = dayjs();
    const currentDay = currentDate.format("YYYY-MM-DD");
    if (date !== currentDay) {
      updateDate(currentDay);
      return;
    }
    const timer = window.setTimeout(
      () => updateDate(dayjs().format("YYYY-MM-DD")),
      currentDate.endOf("day").valueOf() - Date.now() + 1
    );
    return () => window.clearTimeout(timer);
  }, [active, bumpRevision, date, period]);
  const report = useListeningFootprint(revision, active);
  const records = period === "month" ? report.month : report.week;
  const details = records?.details ?? [];
  const weekActive = active && report.loggedIn && period === "week";
  const weekTrend = useListeningWeekTrend({
    date,
    week: report.week,
    active: weekActive
  });
  const chartDetails = period === "week" ? weekTrend.details : details;
  const trendLoading = period === "week" && weekTrend.loading;
  const trendFailed = period === "week" && weekTrend.failed;
  const singlePeriod =
    period !== "today" && chartDetails.length === 1 ? chartDetails[0]?.period : null;
  const singleDate = singlePeriod ? dayjs(singlePeriod) : null;
  const effectiveDay =
    selectedDay ?? (singleDate?.isValid() ? singleDate.format("YYYY-MM-DD") : null);
  const selectedIsToday = effectiveDay === date;
  const today = useTodayTracks({
    active: active && report.loggedIn && (period === "today" || selectedIsToday),
    revision
  });
  const ranked = useRankedTracks({
    active: active && report.loggedIn && period !== "today" && !effectiveDay,
    period: period === "month" ? "month" : "week",
    revision
  });
  const localTracks = useMemo(() => {
    if (!effectiveDay || selectedIsToday) return EMPTY_TRACKS;
    // 本机历史按歌曲保留记录，不作为该日完整云端播放明细。
    return historyRecords.filter(
      (record) => dayjs(record.time).format("YYYY-MM-DD") === effectiveDay
    );
    // historyRecords may mutate in place; historyRevision invalidates this snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDay, historyRecords, historyRevision, selectedIsToday]);
  const localDay = effectiveDay && !selectedIsToday;
  const list = localDay
    ? { tracks: localTracks, loading: false, failed: false, reload: bumpRevision }
    : period === "today" || selectedIsToday
      ? today
      : ranked;
  const tracks = report.loggedIn ? list.tracks : EMPTY_TRACKS;
  const loadedRef = useLatestRef(onTracksLoaded);
  const scopeRef = useLatestRef(onScopeChange);
  const { heartManager, playableManager } = useUserTrackManager();
  const tabsId = useId();

  useEffect(() => loadedRef.current?.(tracks), [loadedRef, tracks]);
  useEffect(() => {
    scopeRef.current?.({ period, ...(effectiveDay ? { day: effectiveDay } : {}) });
  }, [effectiveDay, period, scopeRef]);

  const { onContextMenu } = useTrackContextMenu({
    onPlay,
    onClickAlbum,
    onClickArtist,
    openComment,
    addToPlaylistLast,
    addToPlaylistNext,
    addTrackToPlaylist: openTrackAddToPlaylist
  });
  const refresh = () => {
    if (!report.loggedIn || report.loading || list.loading || trendLoading) return;
    report.reload();
    list.reload();
    if (weekActive) weekTrend.reload();
  };
  useImperativeHandle(actionsRef, () => ({ refresh }));
  const values = {
    today: report.week?.today?.duration,
    week: report.week?.total,
    month: report.month?.total
  };
  const average = records && details.length ? records.total / details.length : null;
  const currentPeriod = periods.find((item) => item.value === period)!;
  const selectedDetail = effectiveDay
    ? chartDetails.find(
        (item) => item.period && dayjs(item.period).format("YYYY-MM-DD") === effectiveDay
      )
    : null;
  const listTitle = localDay
    ? `${dayjs(effectiveDay).format("M月D日")}的本机记录`
    : period === "today" || selectedIsToday
      ? "今日听过的歌曲"
      : currentPeriod.listTitle;
  const emptyTips = !report.loggedIn
    ? "登录后查看听歌足迹"
    : localDay
      ? "没有该日的本机保留记录"
      : list.loading
        ? "正在加载歌曲"
        : list.failed
          ? "暂时无法获取歌曲，可重试"
          : period === "today" || selectedIsToday
            ? "今天还没有收听记录"
            : "本期暂无播放排行";

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {variant === "page" && (
        <header className="mb-2 shrink-0 flex justify-between">
          <section className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight">听歌足迹</h1>
            <p className="mt-1 text-xs opacity-50">
              {localDay
                ? "该日展示本机保留记录"
                : period === "today" || selectedIsToday
                  ? "今日收听时长与听过的歌曲"
                  : period === "week"
                    ? "近7天收听分布与本周前20首歌曲排行"
                    : `${currentPeriod.label}收听分布与前20首歌曲排行`}
            </p>
          </section>
          <IconButton
            className="shrink-0"
            label="刷新听歌足迹"
            variant="plain"
            icon={RotateCwSquare}
            disabled={!report.loggedIn || report.loading || list.loading || trendLoading}
            onClick={refresh}
            iconClassName={cx(
              "size-5!",
              (report.loading || trendLoading) && "animate-spin motion-reduce:animate-none"
            )}
          />
        </header>
      )}
      <div className="flex shrink-0 items-center gap-2">
        <div
          className="grid min-w-0 flex-1 grid-cols-3 gap-1.5"
          role="tablist"
          aria-label="听歌周期">
          {periods.map(({ label, value }) => (
            <button
              key={value}
              id={`${tabsId}-${value}`}
              className={cx(
                "flex min-w-0 cursor-pointer flex-col items-start rounded-md border px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-white/60",
                period === value
                  ? "border-white/20 bg-white/10"
                  : "border-transparent opacity-60 hover:bg-white/5 hover:opacity-90"
              )}
              role="tab"
              type="button"
              aria-label={label}
              aria-selected={period === value}
              aria-controls={`${tabsId}-panel`}
              onClick={() => {
                setPeriod(value);
                setSelectedDay(null);
              }}>
              <span className="text-[10px] opacity-60">{label}收听</span>
              <strong
                className="mt-0.5 w-full truncate text-[17px] font-semibold tabular-nums"
                title={formatListeningDuration(values[value])}
                aria-label={period === value ? "累计收听时长" : undefined}>
                {formatListeningDuration(values[value])}
              </strong>
            </button>
          ))}
        </div>
      </div>
      <div className="flex h-4 shrink-0 items-center justify-between gap-3 px-1 text-[10px] opacity-55">
        {effectiveDay ? (
          <span aria-label="选中日期数据">
            {dayjs(effectiveDay).format("M月D日")} ·{" "}
            {formatListeningDuration(selectedDetail?.duration)}
            {(trendLoading || trendFailed) && (
              <span className="ml-2 opacity-70" role="status">
                {trendLoading ? "补充上周数据中" : "上周统计暂未更新"}
              </span>
            )}
          </span>
        ) : period === "today" ? (
          <span aria-label="今日歌曲数量">
            今日 {report.week?.todayTrackCount != null ? `${report.week.todayTrackCount} 首` : "—"}
          </span>
        ) : (
          <span aria-label="日均收听时长">
            {period === "week" ? "本周日均" : "日均"} {formatListeningDuration(average)}
          </span>
        )}
        {selectedDay ? (
          <button
            className="cursor-pointer hover:opacity-70"
            type="button"
            onClick={() => setSelectedDay(null)}>
            查看整{period === "month" ? "月" : "周"}
          </button>
        ) : (
          (report.loading || report.failed || trendLoading || trendFailed) && (
            <span role="status">
              {report.loading
                ? "更新统计中"
                : trendLoading
                  ? "补充上周数据中"
                  : trendFailed
                    ? "上周统计暂未更新"
                    : "统计暂未完整更新"}
            </span>
          )
        )}
      </div>
      <div
        id={`${tabsId}-panel`}
        className="flex min-h-0 flex-1 flex-col gap-3"
        role="tabpanel"
        aria-labelledby={`${tabsId}-${period}`}>
        {period !== "today" && chartDetails.length > 1 && report.loggedIn && (
          <DailyChart
            key={period}
            variant={variant}
            details={chartDetails}
            selectedDay={effectiveDay}
            label={period === "week" ? "近7天收听" : undefined}
            onSelectDay={setSelectedDay}
          />
        )}
        <section className="flex min-h-0 flex-1 flex-col gap-2 border-t border-white/10 pt-3">
          <header className="flex shrink-0 items-center justify-between gap-3">
            <h3 className="text-xs font-medium opacity-70">{listTitle}</h3>
            <div className="flex items-center gap-2 text-[10px] opacity-50">
              {localDay ? (
                <span>本机保留记录</span>
              ) : period !== "today" && !effectiveDay ? (
                <span>前20首</span>
              ) : null}
              {list.loading && list.tracks.length > 0 && <span>更新中</span>}
              {list.failed && (
                <button
                  className="cursor-pointer hover:opacity-70"
                  type="button"
                  onClick={list.reload}>
                  {period === "today" || selectedIsToday ? "重试今日歌曲" : "重试排行"}
                </button>
              )}
            </div>
          </header>
          <TrackList
            id={
              effectiveDay
                ? dayjs(effectiveDay).valueOf()
                : period === "today"
                  ? 0
                  : period === "week"
                    ? 1
                    : 2
            }
            className="min-h-0 flex-1"
            type="normal"
            tracks={tracks}
            paddingBottom={4}
            emptyTips={emptyTips}
            activeID={activeTrackID}
            heartManager={heartManager}
            playableManager={playableManager}
            trackCoverSize={RendererImageConstants.PlaylistPageTrackCoverSize}
            onClick={onPlay}
            onContext={onContextMenu}
            onClickAlbum={onClickAlbum}
            onClickArtist={onClickArtist}
          />
        </section>
      </div>
    </div>
  );
};

export default ListeningFootprint;
