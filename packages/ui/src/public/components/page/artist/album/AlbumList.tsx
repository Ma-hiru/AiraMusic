import { FC, memo } from "react";
import InfiniteContainer from "@mahiru/ui/public/components/infinite/InfiniteContainer";
import { useAlbum } from "@mahiru/ui/public/hooks/useAlbum";

import AlbumItem from "./AlbumItem";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import { css, cx } from "@emotion/css";

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
