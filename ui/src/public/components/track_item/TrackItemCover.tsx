import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";

import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage";

interface ListItemCoverProps {
  track: NeteaseTrackBase;
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
  fastLocation = false
}) => {
  return (
    <NeteaseImage
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      className={cx(
        `
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-95
        ease-in-out duration-300 transition-all
      `,
        disabled && "cursor-not-allowed"
      )}
      src={track.al.picUrl}
      alt={track.al.name}
      size={NeteaseImageSize.xs}
      pause={fastLocation}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};
export default memo(TrackItemCover);
