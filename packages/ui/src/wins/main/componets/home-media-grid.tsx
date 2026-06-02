import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";

import RendererImageConstants from "@/common/constants/image";
import HomeMediaCard, { type HomeMediaItem } from "@/wins/main/componets/home-media-card";

interface HomeMediaGridProps {
  items: HomeMediaItem[];
  coverSize?: number;
  className?: string;
  onClickItem?: NormalFunc<[id: number]>;
}

const HomeMediaGrid: FC<HomeMediaGridProps> = ({
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

export default memo(HomeMediaGrid);
