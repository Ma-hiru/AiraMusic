import { type FC, memo } from "react";
import { useAlbum } from "@/common/hooks/use-album";
import InfiniteContainer from "@/common/components/layout/infinite/infinite-container";
import AppError from "@/common/components/fallback/app-error";
import HomeMediaGrid from "@/common/components/layout/media-grid";
import { RendererFormat } from "@/common/lib/format";

interface AlbumListProps {
  id: number;
  className?: string;
  onClick: Optional<NormalFunc<[id: number]>>;
}

const AlbumList: FC<AlbumListProps> = ({ id, className, onClick }) => {
  const { album, status, loadMore, reset } = useAlbum({ id });

  return (
    <AppError reset={reset} when={status === "error"} message="专辑加载失败">
      <InfiniteContainer
        className={className}
        hasMore={album.hasMore}
        isLoading={status === "loading"}
        onLoadMore={loadMore}>
        {album.data.length === 0 ? null : (
          <HomeMediaGrid
            onClickItem={onClick ?? undefined}
            items={album.data.map((a) => ({
              id: a.id,
              name: a.name,
              coverUrl: a.picUrl,
              nameClampLine: 1,
              badge: a.size + " 首",
              meta: RendererFormat.time(a.publishTime)
            }))}
          />
        )}
      </InfiniteContainer>
    </AppError>
  );
};

export default memo(AlbumList);
