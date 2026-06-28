import { cx } from "@emotion/css";
import { type FC, memo, useMemo } from "react";
import { NeteaseNetworkImage, NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";

import NeteaseImage from "@/common/components/display/image/netease-image";

interface ListItemCoverProps {
  track: NeteaseTrackRecord;
  trackCoverSize: NeteaseImageSize;
  disabled: boolean;
  onClick?: NormalFunc;
  fastLocation?: boolean;
}

const TrackItemCover: FC<ListItemCoverProps> = ({
  track,
  onClick,
  disabled,
  fastLocation = false,
  trackCoverSize
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
      cache
      cacheLazy={false}
      image={image}
      pause={fastLocation}
      className={cx(
        `
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-98
        ease-in-out duration-300 transition-all
      `,
        disabled && "cursor-not-allowed"
      )}
      onClick={() => !disabled && onClick?.()}
      imageClassName={(disabled && "cursor-not-allowed") || undefined}
      shadowColor="light"
    />
  );
};

export default memo(TrackItemCover);
