import { FC, memo, SyntheticEvent, useCallback } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useBlobOrFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { getDynamicSnapshot, Store } from "@mahiru/ui/store";

interface ListItemCoverProps {
  track: NeteaseTrack;
  absoluteIndex: number;
  playListID: number;
  onClick?: NormalFunc;
}

const ListItemCover: FC<ListItemCoverProps> = ({ track, absoluteIndex, playListID, onClick }) => {
  const sizedURL = NeteaseImageSizeFilter(track.al.cachedPicUrl || track.al.picUrl, ImageSize.xs);

  const onCacheHit = useCallback(
    (file: string, id: string) => {
      const { getPlayListStatic } = getDynamicSnapshot();
      const playList = getPlayListStatic();
      const list = playList.get(playListID);
      if (list) {
        list.playlist.tracks[absoluteIndex]!.al.cachedPicUrl = file;
        list.playlist.tracks[absoluteIndex]!.al.cachedPicUrlID = id;
      }
    },
    [absoluteIndex, playListID]
  );
  const onError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = NeteaseImageSizeFilter(track.al.picUrl, ImageSize.xs) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      const { getPlayListStatic } = getDynamicSnapshot();
      const playList = getPlayListStatic();
      const list = playList.get(playListID);
      if (list) {
        list.playlist.tracks[absoluteIndex]!.al.cachedPicUrl = "";
        void Store.remove(list.playlist.tracks[absoluteIndex]!.al.cachedPicUrlID);
        list.playlist.tracks[absoluteIndex]!.al.cachedPicUrlID = "";
      }
    },
    [absoluteIndex, playListID, track.al.picUrl]
  );

  const cachedCover = useBlobOrFileCache(sizedURL, { onCacheHit });
  return (
    <div className="size-8" onClick={onClick}>
      <img
        src={cachedCover}
        loading="lazy"
        decoding="async"
        className="h-full w-full rounded-md object-cover cursor-pointer hover:scale-105 ease-in-out duration-300 transition-all select-none active:scale-95"
        alt={track.al.name}
        onError={onError}
      />
    </div>
  );
};
export default memo(ListItemCover);
