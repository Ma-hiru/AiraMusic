import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import RendererImageConstants from "@/common/constants/image";
import MediaCard, { type MediaItem } from "@/common/components/layout/media-grid/card";

interface MediaGridProps {
  className?: string;
  coverSize?: number;
  items: MediaItem[];
  onClickItem?: NormalFunc<[id: number, index: number]>;
  onHoverItem?: NormalFunc<[id: number, index: number]>;
  onMouseEnter?: NormalFunc<[id: number, index: number]>;
  onMouseLeave?: NormalFunc<[id: number, index: number]>;
}

const MediaGrid: FC<MediaGridProps> = ({
  className,
  onClickItem,
  onHoverItem,
  onMouseEnter,
  onMouseLeave,
  items,
  coverSize = RendererImageConstants.HomePagePlaylistCoverSize
}) => {
  return (
    <div
      className={cx(
        "grid w-full grid-cols-[repeat(auto-fill,minmax(140px,1fr))] items-start gap-1",
        className
      )}>
      {items.map((item, index) => (
        <MediaCard
          key={item.id}
          item={item}
          coverSize={coverSize}
          onClick={(id) => onClickItem?.(id, index)}
          onHover={(id) => onHoverItem?.(id, index)}
          onMouseEnter={(id) => onMouseEnter?.(id, index)}
          onMouseLeave={(id) => onMouseLeave?.(id, index)}
        />
      ))}
    </div>
  );
};

export default memo(MediaGrid);
