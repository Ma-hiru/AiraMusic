import { cx } from "@emotion/css";
import { memo, type FC, useMemo } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseTrackRecord, NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface ListItemCoverProps {
  disabled: boolean;
  fastLocation?: boolean;
  track: NeteaseTrackRecord;
  trackCoverSize: NeteaseImageSize;
  onClick?: NormalFunc;
}

const TrackItemCover: FC<ListItemCoverProps> = ({
  onClick,
  track,
  disabled,
  trackCoverSize,
  fastLocation = false
}) => {
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromTrackCover(track.detail)
        .setSize(trackCoverSize)
        .setAlt(track.detail.name),
    [track.detail, trackCoverSize]
  );
  return (
    <NeteaseImage
      className={cx(
        `
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-98
        ease-in-out duration-300 transition-all
      `,
        disabled && "cursor-not-allowed"
      )}
      image={image}
      cacheLazy={false}
      shadowColor="light"
      pause={fastLocation}
      imageClassName={(disabled && "cursor-not-allowed") || undefined}
      onClick={() => !disabled && onClick?.()}
      cache
    />
  );
};

export default memo(TrackItemCover);
