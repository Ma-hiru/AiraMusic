import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { CirclePlay, Headphones } from "lucide-react";
import { NeteaseNetworkImage, NeteasePlaylistSummary } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";

import NeteaseImage from "@/common/components/image/netease-image";

interface ItemProps {
  cover: string;
  name: string;
  coverSize?: number;
  trackCount?: number;
  onClick?: NormalFunc;
  className?: string;
  shadowColor?: "dark" | "light";
  playCount?: number;
}

const Item: FC<ItemProps> = ({
  cover,
  coverSize,
  name,
  onClick,
  trackCount,
  className,
  shadowColor,
  playCount
}) => {
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromURL(cover)
        .setSize(coverSize ?? RendererImageConstants.HomePagePlaylistCoverSize)
        .setAlt(name),
    [cover, coverSize, name]
  );
  return (
    <button
      type="button"
      className={cx(
        `
          group inline-flex h-full w-full min-w-0 cursor-pointer select-none flex-col
          items-start justify-start p-2 text-left transition-all duration-300 ease-in-out
          active:scale-[0.98]
        `,
        className
      )}
      onClick={onClick}>
      <div className="h-full w-full rounded-lg">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-white/10 shadow-md">
          <NeteaseImage
            cache
            className="size-full rounded-lg"
            image={image}
            shadowColor={shadowColor}
          />
          {typeof playCount === "number" && (
            <div className="absolute right-1 top-1 z-10 flex items-center justify-center gap-1 rounded-md bg-black/35 px-1.5 py-0.5 text-white backdrop-blur-md">
              <Headphones className="size-3" />
              <p className="text-[10px] font-semibold leading-none">
                {NeteasePlaylistSummary.playCountFormat(playCount)}
              </p>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/25 group-hover:opacity-100">
            <CirclePlay className="size-6 text-white" />
            {typeof trackCount === "number" && (
              <div className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-black/40 px-1.5 py-0.5 text-white backdrop-blur-md">
                <p className="text-[10px] font-bold leading-none">{trackCount} 首</p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-[12px] font-bold leading-4 text-(--text-color-on-main) transition-opacity duration-300 group-hover:opacity-70">
          {name}
        </p>
      </div>
    </button>
  );
};

export default memo(Item);
