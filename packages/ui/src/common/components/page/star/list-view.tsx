import { cx } from "@emotion/css";
import { UserRound, Headphones } from "lucide-react";
import { memo, type FC, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";
import type { MediaItem } from "@/common/components/layout/media-grid/card";

interface StarListViewProps {
  className?: string;
  items: MediaItem[];
  onClickItem?: NormalFunc<[id: number]>;
  onContextItem?: NormalFunc<[e: ReactMouseEvent<HTMLButtonElement>, id: number, index: number]>;
}

/** 收藏分类的列表视图：同一批数据，单屏可显示更多条目 */
const StarListView: FC<StarListViewProps> = ({ className, onClickItem, onContextItem, items }) => {
  const images = useMemo(
    () =>
      items.map((item) =>
        NeteaseNetworkImage.fromURL(item.coverUrl)?.setSize(NeteaseImageSize.sm).setAlt(item.name)
      ),
    [items]
  );

  return (
    <div className={cx("flex w-full flex-col gap-0.5 pb-2", className)}>
      {items.map((item, index) => {
        const meta = [item.meta, item.badge].filter(Boolean).join(" · ");

        return (
          <button
            key={item.id}
            className="
              flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5
              text-left transition-colors duration-200 ease-in-out
              hover:bg-black/10 active:bg-black/15
            "
            type="button"
            onClick={() => onClickItem?.(item.id)}
            onContextMenu={(e) => onContextItem?.(e, item.id, index)}>
            <NeteaseImage
              className={cx(
                "size-10 shrink-0 object-cover surface-border",
                item.shape === "circle" ? "rounded-full" : "rounded-md"
              )}
              image={images[index]}
              fallback={
                item.shape === "circle" ? (
                  <UserRound className="size-5 opacity-35" aria-hidden="true" />
                ) : undefined
              }
              cache
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-5">
                {item.name}
              </span>
              {meta && (
                <span className="block truncate text-[11px] font-medium leading-4 opacity-55">
                  {meta}
                </span>
              )}
            </span>
            {typeof item.playCount === "number" && (
              <div className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums">
                <span>{RendererFormat.count(item.playCount)}</span>
                <Headphones className="size-3 relative -top-px" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default memo(StarListView);
