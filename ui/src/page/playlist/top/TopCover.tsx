import { FC, memo, useCallback } from "react";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

interface TopCoverProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const TopCover: FC<TopCoverProps> = ({ detail }) => {
  const url = detail?.playlist.coverImgUrl;
  const sizedURL = NeteaseImageSizeFilter(url, ImageSize.lg);
  const cachedCover = useFileCache(sizedURL);
  const { setBackground } = useLayout();
  const onLoad = useCallback(() => {
    setBackground(cachedCover);
  }, [cachedCover, setBackground]);
  return (
    <img
      className="size-44 rounded-md shadow-xs select-none"
      src={cachedCover}
      loading="lazy"
      decoding="async"
      alt={detail?.playlist.name}
      onLoad={onLoad}
    />
  );
};
export default memo(TopCover);
