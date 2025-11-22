import { FC, memo, useEffect, useState } from "react";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

interface TopCoverProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const TopCover: FC<TopCoverProps> = ({ detail }) => {
  const url = detail?.playlist.coverImgUrl;
  const sizedURL = setImageURLSize(url, "lg");
  const cachedCover = useFileCache(sizedURL);
  return (
    <img className="size-44 rounded-md shadow-xs" src={cachedCover} alt={detail?.playlist.name} />
  );
};
export default memo(TopCover);
