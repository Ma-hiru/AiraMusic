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
    <div
      className={cx(
        "w-full h-full inline-flex flex-col justify-start items-start p-2 cursor-pointer",
        className
      )}
      onClick={onClick}>
      <div className="w-full h-full rounded-md">
        <div className="w-full overflow-hidden relative rounded-md shadow-lg hover:scale-105 ease-in-out duration-300  transition-all">
          <NeteaseImage
            cache
            className="w-full rounded-md aspect-square"
            image={image}
            shadowColor={shadowColor}
          />
          {typeof playCount === "number" && (
            <div className="absolute right-1 top-1 flex gap-1 justify-center items-center hover:text-white z-10">
              <Headphones className="size-3" />
              <p className="text-[10px] align-middle">
                {NeteasePlaylistSummary.playCountFormat(playCount)}
              </p>
            </div>
          )}
          <div className="absolute inset-0 flex justify-center items-center opacity-0 hover:opacity-100 bg-black/30 transition-opacity duration-300">
            <CirclePlay className="size-5" color="#ffffff" />
            {typeof trackCount === "number" && (
              <div className="absolute left-1 bottom-1">
                <p className="text-white font-semibold text-[10px]">{trackCount} 首</p>
              </div>
            )}
          </div>
        </div>
        <p className="mt-2 font-semibold text-[12px] line-clamp-2 hover:opacity-50 ease-in-out duration-300 transition-opacity">
          {name}
        </p>
      </div>
    </div>
  );
};

export default memo(Item);
