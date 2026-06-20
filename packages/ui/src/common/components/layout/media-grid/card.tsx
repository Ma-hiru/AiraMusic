import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { Headphones } from "lucide-react";
import NeteaseImage from "@/common/components/display/image/netease-image";
import { RendererFormat } from "@/common/lib/format";

export type MediaItem = {
  id: number;
  name: string;
  nameClampLine?: 1 | 2;
  coverUrl?: string;
  meta?: string;
  badge?: string;
  playCount?: number;
  shape?: "square" | "circle";
};

interface MediaCardProps {
  item: MediaItem;
  coverSize: number;
  onClick?: NormalFunc<[id: number]>;
  className?: string;
}

const MediaCard: FC<MediaCardProps> = ({ item, coverSize, onClick, className }) => {
  const image = useMemo(
    () => NeteaseNetworkImage.fromURL(item.coverUrl)?.setSize(coverSize).setAlt(item.name),
    [coverSize, item.coverUrl, item.name]
  );
  const roundedClass = item.shape === "circle" ? "rounded-full" : "rounded-lg";

  return (
    <button
      onClick={() => onClick?.(item.id)}
      className={cx(
        `
          group min-w-0 cursor-pointer p-2 text-left
          transition-all duration-300 ease-in-out active:scale-[0.98]
        `,
        className
      )}>
      <div className={cx("relative aspect-square w-full bg-white/10 shadow-md", roundedClass)}>
        <NeteaseImage cache image={image} className={cx("size-full object-cover", roundedClass)} />
        <div
          className={cx(
            "absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25 overflow-hidden",
            item.shape === "circle" ? "rounded-full" : "rounded-md"
          )}
        />
        {typeof item.playCount === "number" && (
          <div className="absolute right-1 top-1 flex items-center gap-1 rounded-md bg-black/35 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-md">
            <Headphones className="size-3" />
            <span>{RendererFormat.count(item.playCount)}</span>
          </div>
        )}
        {item.badge && (
          <div className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)] truncate rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
            {item.badge}
          </div>
        )}
      </div>
      <p
        title={item.name}
        className={cx(
          `
            mt-2 text-[12px] font-bold leading-4 group-hover:opacity-70
            duration-300 ease-in-out transition-all
          `,
          item.nameClampLine === 1 ? "line-clamp-1" : "line-clamp-2"
        )}>
        {item.name}
      </p>
      {item.meta && (
        <p title={item.meta} className="mt-1 truncate text-[10px] font-semibold opacity-55">
          {item.meta}
        </p>
      )}
    </button>
  );
};

export default memo(MediaCard);
