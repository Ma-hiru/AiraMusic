import { FC, memo, useMemo } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { NeteaseNetworkImage } from "@mahiru/ui/public/models/netease";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import AppInstance from "@mahiru/ui/main/entry/instance";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

const BarCover: FC<object> = () => {
  const player = AppInstance.usePlayer();
  const { layout, updateLayout } = useLayoutStore();
  const { track } = player.current.track || {};
  const { textColorOnMain } = useThemeColor();
  const image = useMemo(
    () =>
      track
        ? NeteaseNetworkImage.fromTrackCover(track).setSize(NeteaseImageSize.sm).setAlt(track.name)
        : null,
    [track]
  );

  return (
    <div className="w-full h-2/3 grid grid-cols-[auto_1fr] grid-rows-1 items-center overflow-hidden">
      <NeteaseImage
        cache
        className="h-12 w-12 min-w-12 min-h-12 rounded-md cursor-pointer"
        image={image}
        onClick={() => {
          updateLayout(layout.copy().setPlayModal(!layout.playModal));
        }}
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
          {track?.artist?.()?.join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
