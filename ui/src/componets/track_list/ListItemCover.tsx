import { FC, memo, useCallback } from "react";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playlist";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface ListItemCoverProps {
  track: NeteaseTrack;
  isMainColorDark: boolean;
  onClick?: NormalFunc;
  entry?: Nullable<PlaylistCacheEntry>;
  entryTrackIdx?: number;
  active?: boolean;
  fastLocation?: boolean;
}

const ListItemCover: FC<ListItemCoverProps> = ({
  track,
  entryTrackIdx,
  onClick,
  entry,
  active = false,
  isMainColorDark,
  fastLocation = false
}) => {
  const onCacheHit = useCallback(
    (file: string, id: string) => {
      // 写入缓存ID
      if (!entry || typeof entryTrackIdx !== "number") return;
      PlaylistManager.updateTrackCoverCache({
        entry,
        trackIdx: entryTrackIdx,
        cachedPicUrl: file,
        cachedPicUrlID: id
      });
    },
    [entry, entryTrackIdx]
  );

  const onCacheError = useCallback(() => {
    if (!entry || typeof entryTrackIdx !== "number") return;
    PlaylistManager.updateTrackCoverCache({
      entry,
      trackIdx: entryTrackIdx,
      cachedPicUrl: "",
      cachedPicUrlID: ""
    });
  }, [entry, entryTrackIdx]);

  return (
    <NeteaseImage
      onClick={onClick}
      className={`
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-95
        ease-in-out duration-300 transition-all
      `}
      src={track.al.cachedPicUrl || track.al.picUrl}
      retryURL={track.al.picUrl}
      alt={track.al.name}
      size={ImageSize.xs}
      onCacheError={onCacheError}
      onCacheHit={onCacheHit}
      fastLocation={fastLocation}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};
export default memo(ListItemCover);
