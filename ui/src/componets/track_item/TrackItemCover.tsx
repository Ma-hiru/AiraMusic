import { FC, memo } from "react";
import { ImageSize } from "@mahiru/ui/utils/filter";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface ListItemCoverProps {
  track: NeteaseTrackBase;
  trackIdx: number;
  isMainColorDark: boolean;
  disabled: boolean;
  onClick?: NormalFunc;
  fastLocation?: boolean;
  onCoverCacheHit?: NormalFunc<[file: string, id: string, idx: number]>;
  onCoverCacheError?: NormalFunc<[idx: number]>;
}

const TrackItemCover: FC<ListItemCoverProps> = ({
  track,
  trackIdx,
  onClick,
  disabled,
  isMainColorDark,
  fastLocation = false,
  onCoverCacheError,
  onCoverCacheHit
}) => {
  return (
    <NeteaseImage
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      className={`
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-95
        ease-in-out duration-300 transition-all
      `}
      src={track.al.cachedPicUrl || track.al.picUrl}
      retryURL={track.al.picUrl}
      alt={track.al.name}
      size={ImageSize.xs}
      onCacheError={() => onCoverCacheError?.(trackIdx)}
      onCacheHit={(file, id) => onCoverCacheHit?.(file, id, trackIdx)}
      fastLocation={fastLocation}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};
export default memo(TrackItemCover);
