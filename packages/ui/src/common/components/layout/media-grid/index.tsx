import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import RendererImageConstants from "@/common/constants/image";
import HomeMediaCard, { type MediaItem } from "@/common/components/layout/media-grid/card";

interface MediaGridProps {
  className?: string;
  coverSize?: number;
  items: MediaItem[];
  onClickItem?: NormalFunc<[id: number]>;
}

const MediaGrid: FC<MediaGridProps> = ({
  className,
  onClickItem,
  items,
  coverSize = RendererImageConstants.HomePagePlaylistCoverSize
}) => {
  return (
    <div
      className={cx(
        "grid w-full grid-cols-[repeat(auto-fill,minmax(140px,1fr))] items-start gap-1",
        className
      )}>
      {items.map((item) => (
        <HomeMediaCard key={item.id} item={item} coverSize={coverSize} onClick={onClickItem} />
      ))}
    </div>
  );
};

export default memo(MediaGrid);
