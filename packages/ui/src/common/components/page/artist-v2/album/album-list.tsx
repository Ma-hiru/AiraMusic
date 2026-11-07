import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { useAlbum } from "@/common/hooks/use-album";
import { RendererFormat } from "@/common/lib/format";
import AppEmpty from "@/common/components/fallback/app-empty";
import AppError from "@/common/components/fallback/app-error";
import HomeMediaGrid from "@/common/components/layout/media-grid";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";

interface AlbumListProps {
  id: number;
  keyword?: string;
  className?: string;
  onClick: Optional<NormalFunc<[id: number]>>;
}

const AlbumList: FC<AlbumListProps> = ({ id, className, onClick, keyword = "" }) => {
  const { album, reset, status, loadMore } = useAlbum({ id });
  const items = useMemo(() => {
    const query = keyword.toLowerCase();
    return album.data
      .filter((album) =>
        [album.name, ...album.alias, ...album.artists.map((artist) => artist.name)]
          .join(" ")
          .toLowerCase()
          .includes(query)
      )
      .map((album) => ({
        id: album.id,
        name: album.name,
        coverUrl: album.picUrl,
        nameClampLine: 2 as const,
        badge: album.size + " 首",
        meta: RendererFormat.time(album.publishTime)
      }));
  }, [album.data, keyword]);

  return (
    <AppError reset={reset} message="专辑加载失败" when={status === "error"}>
      <div className={cx("flex h-full min-h-0 flex-col", className)}>
        <p className="mb-3 shrink-0 text-[11px] font-semibold opacity-60">
          {keyword
            ? `找到 ${items.length} / ${album.data.length} 张已加载专辑`
            : `已加载 ${album.data.length} / ${album.totalAlbum} 张专辑`}
        </p>
        <InfiniteContainer
          className="min-h-0 flex-1"
          hasMore={album.hasMore}
          isLoading={status === "loading"}
          onLoadMore={loadMore}>
          {items.length === 0 && status !== "loading" && (
            <AppEmpty
              className="min-h-40"
              tips={keyword ? "已加载的专辑中没有匹配结果" : "暂无专辑"}
            />
          )}
          {items.length > 0 && (
            <HomeMediaGrid
              className="grid-cols-[repeat(auto-fill,minmax(116px,132px))]! gap-x-2 gap-y-3 pb-3"
              items={items}
              coverSize={256}
              onClickItem={onClick ?? undefined}
            />
          )}
        </InfiniteContainer>
      </div>
    </AppError>
  );
};

export default memo(AlbumList);
