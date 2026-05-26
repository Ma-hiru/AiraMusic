import { type FC, memo } from "react";
import { useAlbum } from "@/common/hooks/use-album";
import { css, cx } from "@emotion/css";

import AlbumItem from "./album-item";
import ThrowIf from "@/common/components/fallback/throw-if";
import InfiniteContainer from "@/common/components/infinite/infinite-container";

interface AlbumListProps {
  id: number;
  className?: string;
  onClick: Optional<NormalFunc<[id: number]>>;
}

const AlbumList: FC<AlbumListProps> = ({ id, className, onClick }) => {
  const { album, status, loadMore } = useAlbum({ id });

  return (
    <>
      <ThrowIf when={status === "error"} message="专辑加载失败" />
      <InfiniteContainer
        className={className}
        hasMore={album.hasMore}
        isLoading={status === "loading"}
        onLoadMore={loadMore}>
        {album.data.length === 0 ? null : (
          <div
            className={cx(
              "gap-8 px-4",
              css`
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                grid-auto-rows: auto;
              `
            )}>
            {album.data.map((item) => (
              <AlbumItem key={item.id} data={item} onClick={onClick} />
            ))}
          </div>
        )}
      </InfiniteContainer>
    </>
  );
};

export default memo(AlbumList);
