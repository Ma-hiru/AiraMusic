import { FC, memo, SyntheticEvent, useCallback } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playList";

interface ListItemCoverProps {
  track: NeteaseTrack;
  absoluteIndex: number;
  playListID?: number;
  onClick?: NormalFunc;
  entry: Nullable<PlaylistCacheEntry>;
  active: boolean;
}

const ListItemCover: FC<ListItemCoverProps> = ({
  track,
  absoluteIndex,
  playListID,
  onClick,
  entry,
  active
}) => {
  const sizedURL = Filter.NeteaseImageSize(track.al.cachedPicUrl || track.al.picUrl, ImageSize.xs);

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
  const onError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = Filter.NeteaseImageSize(track.al.picUrl, ImageSize.xs) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      // 清除缓存
      if (!playListID || !entry) return; // 没有歌单ID不处理(可能是搜索结果、历史记录等)
      PlaylistManager.updateTrackCoverCache({
        entry,
        absoluteIndex,
        cachedPicUrl: "",
        cachedPicUrlID: ""
      });
    },
    [absoluteIndex, entry, playListID, track.al.picUrl]
  );

  const cachedCover = useFileCache(sizedURL, { onCacheHit });
  return (
    <div className="size-8" onClick={onClick}>
      <img
        src={cachedCover}
        loading="lazy"
        decoding="async"
        style={{ boxShadow: active ? "0 0 8px var(--theme-color-main)" : undefined }}
        className="h-full w-full rounded-md object-cover cursor-pointer hover:scale-105 ease-in-out duration-300 transition-all select-none active:scale-95"
        alt={track.al.name}
        onError={onError}
      />
    </div>
  );
};
export default memo(ListItemCover);
