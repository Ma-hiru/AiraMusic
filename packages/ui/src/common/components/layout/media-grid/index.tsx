import { cx } from "@emotion/css";
import { type FC, memo } from "react";

import RendererImageConstants from "@/common/constants/image";
import HomeMediaCard, { type MediaItem } from "@/common/components/layout/media-grid/card";

interface MediaGridProps {
  items: MediaItem[];
  coverSize?: number;
  className?: string;
  onClickItem?: NormalFunc<[id: number]>;
}

const MediaGrid: FC<MediaGridProps> = ({
  items,
  coverSize = RendererImageConstants.HomePagePlaylistCoverSize,
  className,
  onClickItem
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
