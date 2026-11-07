import { cx } from "@emotion/css";
import { LockOpen, LucideLock, ChevronRight } from "lucide-react";
import {
  memo,
  type FC,
  useMemo,
  type JSX,
  useCallback,
  createElement,
  type ComponentProps
} from "react";
import { useUser } from "@/common/store/user";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { createPlaylistStats } from "@/common/utils/playlist";
import { type LikedCollection, createLikedCollection } from "@/common/utils/liked-collection";
import {
  NeteasePlaylist,
  NeteaseNetworkImage,
  NeteasePlaylistSummary
} from "@/common/netease/models";
import {
  useLikedListening,
  type ListeningSong,
  type ListeningRange,
  type ListeningArtist
} from "@/common/hooks/use-liked-listening";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppModal, { createPlaylistCoverModal } from "@/common/components/display/modal";
import type { PlaylistScope } from "@/common/types/playlist-scope";

/** 左栏条目上限：歌曲是固定的封面墙，歌手列表滚动填充剩余高度，故一次给足 */
const RecentSongLimit = 8;
const TopArtistLimit = 24;

/** 左栏只容得下一行指标，时长取整到小时 */
function formatCollectionSpan(duration: number) {
  const minutes = Math.round(duration / 60000);
  if (!Number.isFinite(minutes) || minutes <= 0) return "0 分钟";
  return minutes < 60 ? `${minutes} 分钟` : `${Math.round(minutes / 60)} 小时`;
}

/** 封面角标用的短时间表达，够短才塞得进 40px 的格子 */
function formatPlayMoment(playTime: number) {
  const day = 86400000;
  const diff = Date.now() - playTime;
  if (!Number.isFinite(playTime) || playTime <= 0) return "";
  if (diff < day) return "今天";
  if (diff < 2 * day) return "昨天";
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  const date = new Date(playTime);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

interface TopInfoProps {
  coverCacheKey?: string;
  collection?: LikedCollection;
  summary: Nullable<NeteasePlaylist>;
  onLocateSong?: NormalFunc<[songID: number]>;
  onSelectScope?: NormalFunc<[scope: PlaylistScope]>;
}

const TopInfo: FC<TopInfoProps> = ({
  onLocateSong,
  onSelectScope,
  summary,
  coverCacheKey,
  collection: suppliedCollection
}) => {
  const { create } = AppModal.useModal();
  const user = useUser();
  const isLikedList = !!summary && summary.id === user?.likedPlaylist.id;
  const stats = createPlaylistStats(summary);
  const collection = useMemo(
    () =>
      isLikedList ? (suppliedCollection ?? createLikedCollection(summary?.tracks ?? [])) : null,
    [isLikedList, summary?.tracks, suppliedCollection]
  );
  // 收听数据来自 /user/record 与 /record/recent/song，与收藏数据完全解耦
  const { setRange, range, songs, artists, loading } = useLikedListening(
    user?.profile.userId,
    isLikedList
  );
  const avatar = useMemo(() => {
    return NeteaseNetworkImage.fromUserAvatar(summary?.creator)?.setSize(
      RendererImageConstants.PlaylistPageCreatorAvatarSize
    );
  }, [summary]);
  const openDetails = useCallback(() => {
    if (!summary) return;
    create(createPlaylistCoverModal, { playlist: summary, coverCacheKey });
  }, [coverCacheKey, create, summary]);

  if (!summary) return null;
  const description = summary.description?.trim();
  const isPrivacy = NeteasePlaylistSummary.isPrivacy(summary);
  const LockIcon = isPrivacy ? LucideLock : LockOpen;
  const shownSongs = songs.slice(0, RecentSongLimit);
  const shownArtists = artists.slice(0, TopArtistLimit);
  const maxPlayCount = shownArtists[0]?.playCount ?? 1;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 pt-1">
      <Section className="flex justify-between items-center gap-1" title="创建者" noTitle noPadding>
        <section className="flex flex-1 justify-start items-center gap-1 min-w-0">
          <NeteaseImage className="size-4 shrink-0 rounded-full" image={avatar} cache />
          <p className="select-text text-[12px] font-semibold truncate">
            {summary.creator.nickname}
          </p>
        </section>

        {user?.userId === summary.creator.userId ? (
          <section
            className="shrink-0"
            title={isPrivacy ? "私密歌单" : "公开歌单"}
            children={<LockIcon className="size-3.5 shrink-0" />}
          />
        ) : (
          <span className="flex gap-1 shrink-0 text-[11px] font-semibold">
            {summary.playlistType}
          </span>
        )}
      </Section>
      {isLikedList ? (
        <>
          <p className="shrink-0 select-text text-[10px] leading-4 tabular-nums opacity-60">
            {summary.trackCount || 0} 首 · {formatCollectionSpan(collection?.duration ?? 0)} ·{" "}
            {RendererFormat.time(summary.createTime, ".", true) || "-"} 创建
          </p>
          <section className="shrink-0 border-t border-white/15 pt-2">
            <div className="flex shrink-0 items-center justify-between gap-1">
              <h2 className="min-w-0 truncate text-[12px] font-semibold">
                {range === "week" ? "最近常听" : "最常听的歌曲"}
              </h2>
              <RangeSwitch value={range} onChange={setRange} />
            </div>
            {shownSongs.length > 0 ? (
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {shownSongs.map((song) => (
                  <SongCoverCell key={song.id} song={song} onLocate={onLocateSong} />
                ))}
              </div>
            ) : (
              <p className="mt-1.5 text-[11px] italic leading-4 opacity-40">
                {range === "week" ? "近一周暂无播放记录" : "暂无播放记录"}
              </p>
            )}
          </section>
          {shownArtists.length > 0 && (
            <section className="flex min-h-24 flex-1 flex-col border-t border-white/15 pt-2">
              <h2 className="shrink-0 truncate text-[12px] font-semibold">最常听的歌手</h2>
              <ul
                className={cx(
                  "scrollbar -mx-1 mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1",
                  "transition-opacity duration-200",
                  loading && "opacity-60"
                )}>
                {shownArtists.map((artist, index) => (
                  <li key={artist.id}>
                    <ListeningArtistRow
                      artist={artist}
                      rank={index + 1}
                      max={maxPlayCount}
                      highlight={index === 0}
                      onSelect={onSelectScope}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <>
          <Section title="信息" asChild>
            <dl className="grid select-text grid-cols-2 gap-x-3 gap-y-2.5 sm:grid-cols-3">
              {stats.map(({ label, value, icon: Icon }) => (
                <div key={label} className="min-w-0">
                  <dt className="flex items-center gap-1 text-[10px] leading-4 opacity-55">
                    <Icon className="size-3 shrink-0" />
                    {label}
                  </dt>
                  <dd className="mt-0.5 truncate text-[12px] font-semibold leading-4 tabular-nums opacity-85">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>
          <Section title="标签">
            <div className="flex flex-row justify-start items-center gap-1.5">
              {summary.tags.filter(Boolean).map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-primary/50 text-primary-text px-1 py-px text-[10px] opacity-80">
                  {tag}
                </span>
              ))}
              {summary.tags.length === 0 && (
                <p className="text-[11px] italic opacity-45">暂无标签</p>
              )}
            </div>
          </Section>
          <Section title="简介">
            <p
              className={cx(
                "line-clamp-3 select-text whitespace-pre-wrap text-[11px] leading-4 wrap-break-word",
                description ? "opacity-75" : "italic opacity-45"
              )}>
              {description || "暂无简介"}
            </p>
            {description && (
              <button
                className="mt-1.5 flex cursor-pointer items-center gap-0.5 text-[11px] opacity-65 transition-opacity duration-200 hover:opacity-100"
                type="button"
                onClick={openDetails}>
                展开
                <ChevronRight className="size-3" />
              </button>
            )}
          </Section>
        </>
      )}
    </div>
  );
};

export default memo(TopInfo);

const RangeSwitch: FC<{
  value: ListeningRange;
  onChange: NormalFunc<[value: ListeningRange]>;
}> = ({ onChange, value }) => (
  <div className="flex shrink-0 items-center gap-px rounded-sm bg-white/10 p-px text-[10px] leading-4">
    {(
      [
        ["week", "近一周"],
        ["all", "全部"]
      ] as const
    ).map(([key, label]) => (
      <button
        key={key}
        className={cx(
          "cursor-pointer rounded-sm px-1 transition-colors duration-200",
          value === key ? "bg-white/20 font-semibold" : "opacity-50 hover:opacity-80"
        )}
        type="button"
        aria-pressed={value === key}
        onClick={() => onChange(key)}>
        {label}
      </button>
    ))}
  </div>
);

const ListeningArtistRow: FC<{
  max: number;
  rank: number;
  highlight?: boolean;
  artist: ListeningArtist;
  onSelect?: NormalFunc<[scope: PlaylistScope]>;
}> = ({ onSelect, max, rank, artist, highlight }) => {
  // 播放记录里没有歌手头像，改用名次表达序位，条形表达相对占比
  const percent = Math.max(6, Math.round((artist.playCount / (max || 1)) * 100));
  return (
    <button
      className="
        group flex w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md py-0.5 text-left
        transition-colors duration-200 hover:bg-white/10
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60
      "
      type="button"
      title={`${artist.name} · ${artist.playCount} 次 · ${artist.trackCount} 首`}
      onClick={() => onSelect?.({ kind: "artist", key: `id:${artist.id}` })}>
      <span className="w-3 shrink-0 text-[10px] leading-4 tabular-nums opacity-45">{rank}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-1.5">
          <span className="min-w-0 truncate text-[11px] font-semibold leading-4">
            {artist.name}
          </span>
          <span className="shrink-0 text-[10px] leading-4 tabular-nums opacity-55">
            {artist.playCount}
          </span>
        </span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/10">
          <span
            className={cx(
              "block h-full rounded-full transition-colors duration-200",
              highlight ? "bg-white/85" : "bg-white/45 group-hover:bg-white/70"
            )}
            style={{ width: `${percent}%` }}
          />
        </span>
      </span>
    </button>
  );
};

const SongCoverCell: FC<{
  song: ListeningSong;
  onLocate?: NormalFunc<[songID: number]>;
}> = ({ onLocate, song }) => {
  const image = useMemo(
    () =>
      song.cover ? NeteaseNetworkImage.fromURL(song.cover).setSize(NeteaseImageSize.sm) : null,
    [song.cover]
  );
  const played = song.lastPlayedAt ? formatPlayMoment(song.lastPlayedAt) : "";
  const description = [
    song.name,
    song.artist,
    song.album,
    `${song.playCount} 次`,
    played && `最近播放 ${played}`
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      className="
        group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-white/10
        transition-transform duration-200 ease-in-out active:scale-97
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60
      "
      type="button"
      title={`${description} · 在列表中定位`}
      onClick={() => onLocate?.(song.id)}>
      <NeteaseImage className="size-full" image={image} shadow="none" alt={song.name} cache />
      <span
        className="
          pointer-events-none absolute inset-0 flex items-end justify-end p-1
          bg-black/0 opacity-0 transition-all duration-200
          group-hover:bg-black/30 group-hover:opacity-100
        "
        aria-hidden="true">
        <span className="rounded-sm bg-black/55 px-1 text-[10px] font-semibold tabular-nums text-white">
          ×{song.playCount}
        </span>
      </span>
    </button>
  );
};

const Section: FC<
  ComponentProps<"section"> & {
    show?: boolean;
    asChild?: boolean;
    noTitle?: boolean;
    noPadding?: boolean;
    as?: keyof JSX.IntrinsicElements;
  }
> = ({
  className,
  title,
  children,
  show = true,
  as = "section",
  asChild = false,
  noTitle = false,
  noPadding = false,
  ...rest
}) => {
  if (!show) return null;
  if (asChild) return children;
  return createElement(
    as,
    {
      title,
      className: cx(!noPadding && "border-t border-white/15 pt-2", className),
      ...rest
    },
    <>
      {!!title && !noTitle && <h2 className="mb-1.5 text-[12px] font-semibold">{title}</h2>}
      {children}
    </>
  );
};
