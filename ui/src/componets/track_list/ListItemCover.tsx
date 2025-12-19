import { FC, memo, useCallback } from "react";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playlist";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface ListItemCoverProps {
  track: NeteaseTrack;
  absoluteIndex: number;
  playListID?: number;
  onClick?: NormalFunc;
  entry: Nullable<PlaylistCacheEntry>;
  active: boolean;
  isMainColorDark: boolean;
}

const ListItemCover: FC<ListItemCoverProps> = ({
  track,
  absoluteIndex,
  playListID,
  onClick,
  entry,
  active,
  isMainColorDark
}) => {
  const onCacheHit = useCallback(
    (file: string, id: string) => {
      // 写入缓存ID
      if (!playListID || !entry) return; // 没有歌单ID不处理(可能是搜索结果、历史记录等)
      PlaylistManager.updateTrackCoverCache({
        entry,
        absoluteIndex,
        cachedPicUrl: file,
        cachedPicUrlID: id
      });
    },
    [absoluteIndex, entry, playListID]
  );

  // 清除缓存
  const onCacheError = useCallback(() => {
    // 没有歌单ID不处理(可能是搜索结果、历史记录等)
    if (!playListID || !entry) return;
    PlaylistManager.updateTrackCoverCache({
      entry,
      absoluteIndex,
      cachedPicUrl: "",
      cachedPicUrlID: ""
    });
  }, [absoluteIndex, entry, playListID]);

  return (
    <NeteaseImage
      onClick={onClick}
      className={`
        size-8 rounded-md cursor-pointer select-none
        hover:scale-105 active:scale-95
        ease-in-out duration-300 transition-all
      `}
      src={track.al.cachedPicUrl || track.al.picUrl}
      alt={track.al.name}
      size={ImageSize.xs}
      onCacheError={onCacheError}
      onCacheHit={onCacheHit}
      shadow={active ? "float" : "base"}
      shadowColor={isMainColorDark ? "dark" : "light"}
    />
  );
};
export default memo(ListItemCover);
