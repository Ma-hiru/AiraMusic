import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";

import { cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const BarCover: FC<object> = () => {
  const { trackStatus } = usePlayer();
  const track = trackStatus?.track;
  const { TogglePlayerModalVisible } = useLayout();
  const cachedCover = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.md));
  const { textColorOnMain } = useThemeColor();
  return (
    <div className="h-2/3 space-x-2 flex items-center justify-start gap-2 overflow-hidden pr-6 truncate">
      <div className={cx("h-12 w-12 rounded-md overflow-hidden", cachedCover && "shadow-lg")}>
        <img
          className="h-full w-full aspect-square object-cover cursor-pointer"
          loading="lazy"
          decoding="async"
          src={cachedCover}
          alt={track?.name}
          onClick={TogglePlayerModalVisible}
        />
      </div>
      <div className="flex flex-col gap-0 items-start truncate">
        <div
          className="text-sm font-bold text-center truncate max-w-max"
          style={{ color: textColorOnMain.hex() }}>
          {track?.name}
        </div>
        <div
          className="text-xs text-center font-medium text-gray-500 truncate max-w-max opacity-70"
          style={{ color: textColorOnMain.hex() }}>
          {track?.ar?.map((a) => a.name).join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
