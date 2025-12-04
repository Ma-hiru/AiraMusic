import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

const BarCover: FC<object> = () => {
  const { info } = usePlayer();
  const { TogglePlayerModalVisible } = useLayout();
  const cachedCover = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.md));
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2">
      <div className="h-12 w-12 rounded-md overflow-hidden">
        <img
          className="h-full w-full object-cover cursor-pointer"
          loading="lazy"
          decoding="async"
          src={(cachedCover || null) as string}
          alt={info.title}
          onClick={TogglePlayerModalVisible}
        />
      </div>
      <div className="flex flex-col gap-0 items-start truncate">
        <div className="text-sm font-medium text-center truncate max-w-max">{info.title}</div>
        <div className="text-xs text-center text-gray-500 truncate max-w-max">
          {(info.artist || []).map((a) => a.name).join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
