import { type FC, memo, useMemo } from "react";
import { useThemeColor } from "@mahiru/ui/common/hooks/useThemeColor";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import { NeteaseNetworkImage } from "@mahiru/ui/common/source/netease/models";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@mahiru/ui/windows/main/atoms/layout";

import AppEntry from "@mahiru/ui/windows/main/entry";
import NeteaseImage from "@mahiru/ui/common/components/image/NeteaseImage";

const BarCover: FC<object> = () => {
  const setPlayModal = useSetAtom(playModalAtom);
  const { textColorOnMain } = useThemeColor();
  const player = AppEntry.usePlayer();
  const track = player.current.track?.detail;
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
        onClick={() => setPlayModal(true)}
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
          {track?.artist?.join(" / ")}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
