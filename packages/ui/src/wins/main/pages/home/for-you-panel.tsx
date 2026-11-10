import { cx } from "@emotion/css";
import { UserRound, ChevronRight, RotateCwSquare } from "lucide-react";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useListeningWeekTrend } from "@/common/hooks/use-listening-week-trend";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { NeteaseNetworkImage, type NeteaseTrackRecord } from "@/common/netease/models";
import { openListeningFootprintDisplay } from "@/wins/main/lib/open-listening-footprint-display";
import {
  type ListeningPeriod,
  useListeningFootprint,
  formatListeningDuration
} from "@/common/hooks/use-listening-footprint";
import dayjs from "dayjs";
import Tooltip from "@/common/components/display/tooltip";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import IconButton from "@/common/components/data-input/icon-button";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppDrawer, {
  createPlayerListeningFootprintDrawer
} from "@/common/components/display/drawer";

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const openAccount = async () => {
  await RendererWindow.display.reactReadyAwait();
  RendererIPCMessageBus.display.deliver({ type: "settings" });
};

const ForYouPanel: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const [date, setDate] = useState(() => dayjs());
  const [revision, setRevision] = useState(0);
  const report = useListeningFootprint(revision);
  const modalTracksRef = useRef<NeteaseTrackRecord[]>([]);
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay, player } =
    usePlayerActionInList(() => modalTracksRef.current);
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();

  useEffect(
    () => RendererPlayerHandle.player.history.addListener(() => setRevision((value) => value + 1)),
    []
  );
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        setDate(dayjs());
        setRevision((value) => value + 1);
      },
      date.endOf("day").valueOf() - Date.now() + 1
    );
    return () => window.clearTimeout(timer);
  }, [date]);

  const onTracksLoaded = useCallback((tracks: NeteaseTrackRecord[]) => {
    modalTracksRef.current = tracks;
  }, []);
  const openReport = useCallback(
    (initialPeriod: ListeningPeriod, initialDay?: string) => {
      if (!report.loggedIn) {
        void openAccount();
        return;
      }
      modalTracksRef.current = [];
      AppDrawer._create(createPlayerListeningFootprintDrawer, {
        player,
        initialPeriod,
        initialDay,
        onPageAction: openListeningFootprintDisplay,
        onTracksLoaded,
        onPlay: onTrackPlay,
        onClickAlbum: jumpAlbumPage,
        onClickArtist: jumpArtistPage,
        openComment: openTrackComment,
        addToPlaylistLast: addTrackToPlaylistLast,
        addToPlaylistNext: addTrackToPlaylistNext
      });
    },
    [
      player,
      report.loggedIn,
      onTracksLoaded,
      onTrackPlay,
      jumpAlbumPage,
      jumpArtistPage,
      openTrackComment,
      addTrackToPlaylistLast,
      addTrackToPlaylistNext
    ]
  );
  const registration = user?.profile.createTime;
  const week = report.loggedIn ? report.week : null;
  const month = report.loggedIn ? report.month : null;
  const trend = useListeningWeekTrend({
    week,
    date: date.format("YYYY-MM-DD"),
    active: report.loggedIn
  });
  const songCount = week?.todayTrackCount;
  const todayDuration = formatListeningDuration(week?.today?.duration);
  const todayDurationParts = todayDuration.match(/\d+|\D+/g) ?? [todayDuration];
  const trendDetails = trend.details;
  const hasTrendRecords = trendDetails.some((item) => (item.duration ?? 0) > 0);
  const maxDuration = Math.max(1, ...trendDetails.map((item) => item.duration ?? 0));
  const hasPreviousWeek = trendDetails.some((item) => item.previousWeek);
  const loading = report.loading || trend.loading;
  const refresh = () => {
    report.reload();
    trend.reload();
  };
  const trendTips = !report.loggedIn
    ? "登录后查看趋势"
    : report.loading && !week
      ? "正在同步趋势"
      : report.failed && !week
        ? "本周统计暂不可用"
        : trend.loading
          ? "正在补齐近7天"
          : trend.failed
            ? "上周数据暂不可用"
            : trendDetails.length > 0 && trendDetails.every((item) => item.duration != null)
              ? "近7天还没有收听记录"
              : "近7天暂无趋势";

  return (
    <aside
      className={cx(
        "relative min-h-57 w-full min-w-0 overflow-hidden rounded-xl border border-white/15 bg-linear-to-br from-white/12 via-white/5 to-primary/50 p-3 shadow-md backdrop-saturate-150 backdrop-blur-lg lg:h-full",
        className
      )}
      aria-label="听歌足迹"
      aria-busy={loading}>
      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/10 via-transparent to-white/20" />
      <div className="relative flex h-full min-h-0 flex-col gap-1.5">
        <header className="flex shrink-0 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              className="size-9 shrink-0 cursor-pointer rounded-full outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-white/60 active:scale-95"
              title="账号设置"
              type="button"
              aria-label="账号设置"
              onClick={openAccount}>
              {user ? (
                <NeteaseImage
                  className="size-9 rounded-full border border-white/20"
                  shadow="base"
                  cacheLazy={false}
                  image={NeteaseNetworkImage.fromUserAvatar(user)}
                  cache
                />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-full bg-white/10">
                  <UserRound className="size-5 opacity-70" />
                </span>
              )}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {user?.profile.nickname ?? "发现音乐"}
              </p>
              <p
                className="mt-0.5 truncate text-[10px] opacity-60"
                title={
                  registration ? dayjs(registration).format("YYYY年MM月DD日") + "注册" : undefined
                }>
                {user ? "注册" + RendererFormat.yearsAndDays(registration) : "登录后记录听歌足迹"}
              </p>
            </div>
          </div>
          <time
            className="ml-auto flex shrink-0 items-center gap-2 text-right"
            title={date.format("YYYY年MM月DD日")}
            dateTime={date.format("YYYY-MM-DD")}
            aria-label={date.format("YYYY年MM月DD日")}>
            <span className="text-[36px] font-semibold leading-none tracking-tight tabular-nums">
              {date.format("DD")}
            </span>
            <span className="flex flex-col items-end gap-0.5 text-[11px] leading-tight opacity-60">
              <span>{date.format("MM月")}</span>
              <span>{WEEKDAYS[date.day()]}</span>
            </span>
          </time>
        </header>
        <div className="shrink-0 border-t border-white/10 pt-1.5">
          <button
            className="group flex w-full min-w-0 cursor-pointer items-end justify-between gap-3 rounded-md px-1 text-left outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/60"
            type="button"
            aria-label={report.loggedIn ? "查看今日听歌足迹" : "登录查看听歌足迹"}
            onClick={() => openReport("today")}>
            <div className="min-w-0">
              <span className="block text-[10px] opacity-60">今日收听</span>
              <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-2">
                <strong
                  className="flex items-baseline whitespace-nowrap font-semibold leading-none tabular-nums"
                  aria-label="今日收听时长">
                  {todayDurationParts.map((part, index) => (
                    <span
                      key={`${part}-${index}`}
                      className={
                        /\d+/.test(part) || part === "—"
                          ? "text-[32px] tracking-tight"
                          : "mx-0.5 text-[11px] font-normal opacity-60"
                      }>
                      {part}
                    </span>
                  ))}
                </strong>
                <span
                  className="flex shrink-0 items-baseline gap-1 border-l border-white/10 pl-4 leading-none tabular-nums"
                  aria-label="今日歌曲数量">
                  <span className="text-2xl font-medium leading-none">{songCount ?? "—"}</span>
                  <span className="text-[10px] opacity-60">首歌曲</span>
                </span>
              </div>
            </div>
            <ChevronRight className="mb-0.5 size-4 shrink-0 opacity-45" />
          </button>
        </div>
        <section
          className="flex min-h-16 min-w-0 flex-1 flex-col border-t border-white/10 pt-1.5"
          aria-label="近7天收听趋势">
          <div className="mb-1 flex min-w-0 shrink-0 items-baseline justify-between gap-2">
            <button
              className="min-w-max cursor-pointer rounded-sm text-[10px] opacity-55 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-white/60"
              type="button"
              aria-label="查看本周听歌足迹"
              onClick={() => openReport("week")}>
              近7天
            </button>
            <span className="min-w-0 flex-1 truncate text-[9px] opacity-45" role="status">
              {report.loading && week
                ? "更新中"
                : report.failed && week
                  ? "部分统计暂未更新"
                  : trend.loading
                    ? "补齐中"
                    : trend.failed
                      ? "上周暂不可用"
                      : hasPreviousWeek && (
                          <span className="inline-flex items-center gap-1">
                            <span className="size-1.5 rounded-sm bg-white/25" />
                            上周
                          </span>
                        )}
            </span>
            <span
              className="shrink-0 text-[11px] font-medium tabular-nums"
              aria-label="本周收听时长">
              <span className="mr-1 text-[9px] font-normal opacity-55">本周</span>
              {formatListeningDuration(week?.total)}
            </span>
          </div>
          {hasTrendRecords ? (
            <ol
              className="grid min-h-10 flex-1 auto-cols-fr grid-flow-col gap-2"
              aria-label="近7天每日收听时长">
              {trendDetails.map((item, index) => {
                const day = item.period ? dayjs(item.period) : null;
                const validDay = day?.isValid() ? day : null;
                const label = validDay ? validDay.format("M月D日") : `第${index + 1}天`;
                const duration =
                  item.duration == null ? "暂未获取" : formatListeningDuration(item.duration);
                const isToday = validDay?.isSame(date, "day") ?? false;
                return (
                  <li
                    key={item.period}
                    className="min-h-0 min-w-0"
                    data-previous-week={item.previousWeek}>
                    <Tooltip
                      className="h-full w-full min-w-0"
                      tooltipLabel={`${label}收听时长`}
                      content={
                        <div className="whitespace-nowrap rounded-md border border-white/15 bg-black/85 px-3 py-2 text-white shadow-lg backdrop-blur-lg">
                          <p className="text-[10px] opacity-65">
                            {label}
                            {item.previousWeek && <span className="ml-2">上周</span>}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold tabular-nums">{duration}</p>
                        </div>
                      }
                      portal>
                      <button
                        className="group flex h-full w-full min-w-0 cursor-pointer flex-col justify-end gap-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                        type="button"
                        aria-label={`${label}，${duration}${item.previousWeek ? "（上周）" : ""}`}
                        onClick={() => openReport("week", validDay?.format("YYYY-MM-DD"))}>
                        <span
                          className="flex min-h-0 w-full flex-1 items-end justify-center"
                          aria-hidden="true">
                          <span
                            className={cx(
                              "w-2.5 max-w-[60%] rounded-t-sm transition-colors",
                              item.duration == null
                                ? "h-0 border-t border-dashed border-white/30"
                                : "min-h-px",
                              item.duration == null
                                ? null
                                : isToday
                                  ? "bg-white/90"
                                  : item.previousWeek
                                    ? "bg-white/25 group-hover:bg-white/50 group-focus-visible:bg-white/50"
                                    : "bg-white/55 group-hover:bg-white/75 group-focus-visible:bg-white/75"
                            )}
                            style={{
                              height:
                                item.duration == null
                                  ? undefined
                                  : `${Math.max(0, (item.duration / maxDuration) * 100)}%`
                            }}
                          />
                        </span>
                        <span
                          className={cx(
                            "h-3 w-full truncate text-center text-[9px] tabular-nums",
                            isToday ? "opacity-80" : item.previousWeek ? "opacity-35" : "opacity-55"
                          )}
                          aria-hidden="true">
                          {isToday
                            ? "今"
                            : validDay
                              ? WEEKDAYS[validDay.day()]!.slice(-1)
                              : index + 1}
                        </span>
                      </button>
                    </Tooltip>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div
              className="flex min-h-10 flex-1 items-center justify-center text-[10px] opacity-45"
              role="status">
              {trendTips}
            </div>
          )}
        </section>
        <footer className="flex min-w-0 shrink-0 items-center justify-between gap-3 border-t border-white/10 pt-1.5 text-[10px]">
          <button
            className="flex min-w-0 cursor-pointer items-baseline gap-2 rounded-sm text-left opacity-65 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60"
            type="button"
            aria-label="查看本月听歌足迹"
            onClick={() => openReport("month")}>
            <span className="shrink-0">本月累计</span>
            <span className="truncate font-medium tabular-nums" aria-label="本月收听时长">
              {formatListeningDuration(month?.total)}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-2">
            <IconButton
              label="刷新听歌足迹"
              size="compact"
              variant="plain"
              icon={RotateCwSquare}
              disabled={!report.loggedIn || loading}
              iconClassName={cx("size-4.5!", loading && "animate-spin motion-reduce:animate-none")}
              onClick={refresh}
            />
            <button
              className="flex shrink-0 cursor-pointer items-center gap-0.5 rounded-sm opacity-65 outline-none transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60"
              type="button"
              aria-label="查看听歌足迹"
              onClick={() => openReport("week")}>
              查看足迹
              <ChevronRight className="size-3" />
            </button>
          </div>
        </footer>
      </div>
    </aside>
  );
};

export default memo(ForYouPanel);
