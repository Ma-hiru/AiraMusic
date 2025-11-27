import { FC, memo } from "react";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

interface TopCoverProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const TopCover: FC<TopCoverProps> = ({ detail }) => {
  const url = detail?.playlist.coverImgUrl;
  const sizedURL = NeteaseImageSizeFilter(url, ImageSize.lg);
  const cachedCover = useFileCache(sizedURL);
  return (
    <img className="size-44 rounded-md shadow-xs" src={cachedCover} alt={detail?.playlist.name} />
  );
};
export default memo(TopCover);
