import { FC, memo, SyntheticEvent, useCallback } from "react";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { useBlobOrFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { getDynamicSnapshot, Store } from "@mahiru/ui/store";

interface ListItemCoverProps {
  track: NeteaseTrack;
  index: number;
  playListID: number;
}

const ListItemCover: FC<ListItemCoverProps> = ({ track, index, playListID }) => {
  const sizedURL = NeteaseImageSizeFilter(track.al.cachedPicUrl || track.al.picUrl, ImageSize.xs);
  const cachedCover = useBlobOrFileCache(sizedURL, {
    onCacheHit: (file, id) => {
      const { getPlayListStatic } = getDynamicSnapshot();
      const playList = getPlayListStatic();
      const list = playList.get(playListID);
      if (list) {
        list.playlist.tracks[index]!.al.cachedPicUrl = file;
        list.playlist.tracks[index]!.al.cachedPicUrlID = id;
      }
    }
  });
  const onError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = NeteaseImageSizeFilter(track.al.picUrl, ImageSize.xs) as string;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      console.log(`List Image load error: ${cachedCover}, fallback to original picUrl: ${raw}`);
      const { getPlayListStatic } = getDynamicSnapshot();
      const playList = getPlayListStatic();
      const list = playList.get(playListID);
      if (list) {
        list.playlist.tracks[index]!.al.cachedPicUrl = "";
        void Store.remove(list.playlist.tracks[index]!.al.cachedPicUrlID);
        list.playlist.tracks[index]!.al.cachedPicUrlID = "";
      }
    },
    [cachedCover, index, playListID, track.al.picUrl]
  );
  return (
    <img src={cachedCover} className="size-8 rounded-md" alt={track.al.name} onError={onError} />
  );
};
export default memo(ListItemCover);
