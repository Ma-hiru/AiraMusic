import { cx } from "@emotion/css";
import { memo, type FC, useState, useEffect, useCallback } from "react";
import AppEmpty from "@/common/components/fallback/app-empty";
import MediaCard from "@/common/components/layout/media-grid/card";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import type { LikedAlbum } from "@/common/utils/liked-collection";

interface LikedAlbumsProps {
  query: string;
  className?: string;
  totalCount: number;
  albums: LikedAlbum[];
  onSelect: NormalFunc<[album: LikedAlbum]>;
}

const pageSize = 40;

const LikedAlbums: FC<LikedAlbumsProps> = ({ className, onSelect, query, albums, totalCount }) => {
  const [page, setPage] = useState({ albums, query, limit: pageSize });
  const limit = page.albums === albums && page.query === query ? page.limit : pageSize;
  const loadMore = useCallback(() => {
    setPage({ albums, query, limit: limit + pageSize });
  }, [albums, limit, query]);

  useEffect(() => {
    setPage((previous) =>
      previous.albums === albums && previous.query === query
        ? previous
        : { albums, query, limit: pageSize }
    );
  }, [albums, query]);

  return (
    <div className={cx("flex h-full min-h-0 w-full flex-col", className)}>
      <p className="mb-3 shrink-0 text-[11px] font-semibold opacity-60">
        {query
          ? `已显示 ${Math.min(limit, albums.length)} / ${albums.length} 张匹配专辑（共 ${totalCount} 张）`
          : `已加载 ${Math.min(limit, albums.length)} / ${totalCount} 张专辑`}
      </p>
      {albums.length === 0 ? (
        <div className="min-h-0 flex-1">
          <AppEmpty tips={query ? "没有找到匹配的专辑" : "暂无专辑"} />
        </div>
      ) : (
        <InfiniteContainer
          key={query}
          className="min-h-0 flex-1 pr-2 [scrollbar-gutter:stable]"
          isLoading={false}
          hasMore={limit < albums.length}
          onLoadMore={loadMore}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(116px,132px))] items-start gap-x-2 gap-y-3 pb-3">
            {albums.slice(0, limit).map((album) => (
              <MediaCard
                key={album.key}
                coverSize={256}
                onClick={() => onSelect(album)}
                item={{
                  id: album.id,
                  name: album.name,
                  meta: album.artist,
                  coverUrl: album.cover,
                  badge: `已喜欢 ${album.trackIDs.length} 首`
                }}
              />
            ))}
          </div>
        </InfiniteContainer>
      )}
    </div>
  );
};

export default memo(LikedAlbums);
