import { FC, memo } from "react";
import { NeteaseImageSize } from "@mahiru/ui/utils/image";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";

import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

const BarCover: FC<object> = () => {
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { TogglePlayerVisible } = useLayoutStore(["TogglePlayerVisible"]);
  const { textColorOnMain } = useThemeColor();
  const track = PlayerTrackStatus?.track;

  return (
    <div className="w-full h-2/3 grid grid-cols-[auto_1fr] grid-rows-1 items-center overflow-hidden">
      <NeteaseImage
        className="h-12 w-12 min-w-12 min-h-12 rounded-md cursor-pointer"
        size={NeteaseImageSize.md}
        src={track?.al.picUrl}
        alt={track?.name}
        onClick={TogglePlayerVisible}
        shadow={track?.al.picUrl ? "base" : "none"}
      />
      <div className="w-full pl-2 pr-6 flex flex-col items-start overflow-hidden">
        <div
          className="text-sm font-bold text-center truncate"
          style={{ color: textColorOnMain.string() }}>
          {track?.name}
        </div>
        <div
          className="text-xs text-center font-medium text-gray-500 truncate opacity-70"
          style={{ color: textColorOnMain.string() }}>
          {track?.ar?.map((a) => a.name).join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
