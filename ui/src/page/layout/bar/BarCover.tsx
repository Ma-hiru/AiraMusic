import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { cx } from "@emotion/css";

const BarCover: FC<object> = () => {
  const { info } = usePlayer();
  const { TogglePlayerModalVisible } = useLayout();
  const cachedCover = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.md));
  const textColor = useTextColorOnThemeColor();
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2 overflow-hidden pr-6 truncate">
      <div className={cx("h-12 w-12 rounded-md overflow-hidden", cachedCover && "shadow-lg")}>
        <img
          className="h-full w-full aspect-square object-cover cursor-pointer"
          loading="lazy"
          decoding="async"
          src={cachedCover}
          alt={info.title}
          onClick={TogglePlayerModalVisible}
        />
      </div>
      <div className="flex flex-col gap-0 items-start truncate">
        <div
          className="text-sm font-bold text-center truncate max-w-max"
          style={{ color: textColor }}>
          {info.title}
        </div>
        <div
          className="text-xs text-center font-medium text-gray-500 truncate max-w-max opacity-70"
          style={{ color: textColor }}>
          {(info.artist || []).map((a) => a.name).join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
