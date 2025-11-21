import { FC, memo, useEffect, useState } from "react";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";

interface TopCoverProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const TopCover: FC<TopCoverProps> = ({ detail }) => {
  const [cachedCover, setCachedCover] = useState<Nullable<string>>(null);
  useEffect(() => {
    detail?.playlist.coverImgUrl &&
      setCachedCover(wrapCacheUrl(setImageURLSize(detail?.playlist.coverImgUrl, "lg")));
  }, [detail?.playlist.coverImgUrl]);
  return (
    <img
      className="size-44 rounded-md shadow-xs"
      src={cachedCover as string}
      alt={detail?.playlist.name}
    />
  );
};
export default memo(TopCover);
