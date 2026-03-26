import { cx } from "@emotion/css";
import { FC, memo, useMemo } from "react";
import { NeteaseNetworkImage, NeteaseTrackRecord } from "@mahiru/ui/public/models/netease";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

interface ListItemCoverProps {
  track: NeteaseTrackRecord;
  trackCoverSize: NeteaseImageSize;
  isMainColorDark: boolean;
  disabled: boolean;
  onClick?: NormalFunc;
  fastLocation?: boolean;
}

const TrackItemCover: FC<ListItemCoverProps> = ({
  track,
  onClick,
  disabled,
  isMainColorDark,
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
      className={cx(
        `
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-95
        ease-in-out duration-300 transition-all
      `,
        disabled && "cursor-not-allowed"
      )}
      onClick={() => !disabled && onClick?.()}
      cache
      imageClassName={(disabled && "cursor-not-allowed") || undefined}
      image={image}
      pause={fastLocation}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};

export default memo(TrackItemCover);
