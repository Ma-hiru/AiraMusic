import { cx } from "@emotion/css";
import { UserRound } from "lucide-react";
import { memo, type FC, useMemo, useState, useEffect, useCallback } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import AppEmpty from "@/common/components/fallback/app-empty";
import NeteaseImage from "@/common/components/display/image/netease-image";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import type { LikedArtist } from "@/common/utils/liked-collection";

interface LikedArtistsProps {
  query: string;
  className?: string;
  totalCount: number;
  artists: LikedArtist[];
  onSelect: NormalFunc<[artist: LikedArtist]>;
}

const pageSize = 40;
const LikedArtists: FC<LikedArtistsProps> = ({
  className,
  onSelect,
  query,
  artists,
  totalCount
}) => {
  const [page, setPage] = useState({ artists, query, limit: pageSize });
  const limit = page.artists === artists && page.query === query ? page.limit : pageSize;
  const loadMore = useCallback(() => {
    setPage({ artists, query, limit: limit + pageSize });
  }, [artists, limit, query]);

  useEffect(() => {
    setPage((previous) =>
      previous.artists === artists && previous.query === query
        ? previous
        : { artists, query, limit: pageSize }
    );
  }, [artists, query]);

  return (
    <div className={cx("flex h-full min-h-0 w-full flex-col", className)}>
      <p className="mb-3 shrink-0 text-[11px] font-semibold opacity-60">
        {query
          ? `已显示 ${Math.min(limit, artists.length)} / ${artists.length} 位匹配歌手（共 ${totalCount} 位）`
          : `已加载 ${Math.min(limit, artists.length)} / ${totalCount} 位歌手`}
      </p>
      {artists.length === 0 ? (
        <div className="min-h-0 flex-1">
          <AppEmpty tips={query ? "没有找到匹配的歌手" : "暂无歌手"} />
        </div>
      ) : (
        <InfiniteContainer
          key={query}
          className="min-h-0 flex-1 pr-2 [scrollbar-gutter:stable]"
          isLoading={false}
          hasMore={limit < artists.length}
          onLoadMore={loadMore}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 pb-3">
            {artists.slice(0, limit).map((artist) => (
              <ArtistCard key={artist.key} artist={artist} onSelect={onSelect} />
            ))}
          </div>
        </InfiniteContainer>
      )}
    </div>
  );
};

export default memo(LikedArtists);

const ArtistCard: FC<{
  artist: LikedArtist;
  onSelect: NormalFunc<[artist: LikedArtist]>;
}> = ({ onSelect, artist }) => {
  const covers = useMemo(
    () =>
      artist.covers
        .slice(0, 4)
        .map((cover) => NeteaseNetworkImage.fromURL(cover).setSize(NeteaseImageSize.sm)),
    [artist.covers]
  );

  return (
    <button
      className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-2 text-left transition-colors duration-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
      type="button"
      aria-label={`${artist.name}，已喜欢 ${artist.trackIDs.length} 首`}
      onClick={() => onSelect(artist)}>
      <span
        className={cx(
          "grid size-13 shrink-0 overflow-hidden rounded-md bg-white/10",
          covers.length > 1 && "grid-cols-2",
          covers.length > 2 && "grid-rows-2"
        )}>
        {covers.length ? (
          covers.map((cover, index) => (
            <NeteaseImage
              key={cover.src}
              className={cx(
                "size-full min-h-0 min-w-0",
                covers.length === 3 && index === 2 && "col-span-2"
              )}
              alt=""
              image={cover}
              shadow="none"
              cache
            />
          ))
        ) : (
          <UserRound className="size-6 place-self-center opacity-35" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold" title={artist.name}>
          {artist.name}
        </span>
        <span className="mt-1 block text-[11px] opacity-55">
          已喜欢 {artist.trackIDs.length} 首
        </span>
      </span>
    </button>
  );
};
