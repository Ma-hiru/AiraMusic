import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { Headphones } from "lucide-react";
import { NeteaseNetworkImage, NeteasePlaylistSummary } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";

import NeteaseImage from "@/common/components/image/netease-image";

export interface HomeMediaItem {
  id: number;
  name: string;
  coverUrl?: string;
  meta?: string;
  badge?: string;
  playCount?: number;
  shape?: "square" | "circle";
}

interface HomeMediaGridProps {
  items: HomeMediaItem[];
  coverSize?: number;
  className?: string;
  onClickItem?: NormalFunc<[id: number]>;
}

interface HomeMediaCardProps {
  item: HomeMediaItem;
  coverSize: number;
  onClick?: NormalFunc<[id: number]>;
}

const HomeMediaCard: FC<HomeMediaCardProps> = ({ item, coverSize, onClick }) => {
  const image = useMemo(
    () => NeteaseNetworkImage.fromURL(item.coverUrl)?.setSize(coverSize).setAlt(item.name),
    [coverSize, item.coverUrl, item.name]
  );
  const roundedClass = item.shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <button
      type="button"
      onClick={() => onClick?.(item.id)}
      className="
        group min-w-0 cursor-pointer select-none p-2 text-left
        transition-all duration-300 ease-in-out active:scale-[0.98]
      ">
      <div
        className={cx(
          "relative aspect-square w-full overflow-hidden bg-white/10 shadow-md",
          roundedClass
        )}>
        <NeteaseImage
          cache
          image={image}
          className={cx("size-full object-cover transition-transform duration-500", roundedClass)}
        />
        {item.shape !== "circle" && (
          <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25" />
        )}
        {typeof item.playCount === "number" && (
          <div className="absolute right-1 top-1 flex items-center gap-1 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            <Headphones className="size-3" />
            <span>{NeteasePlaylistSummary.playCountFormat(item.playCount)}</span>
          </div>
        )}
        {item.badge && (
          <div className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
            {item.badge}
          </div>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[12px] font-bold leading-4 text-(--text-color-on-main) transition-opacity duration-300 group-hover:opacity-70">
        {item.name}
      </p>
      {item.meta && (
        <p className="mt-1 truncate text-[10px] font-semibold opacity-55">{item.meta}</p>
      )}
    </button>
  );
};

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
