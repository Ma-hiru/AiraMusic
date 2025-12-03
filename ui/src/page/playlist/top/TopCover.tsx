import { FC, memo, useCallback } from "react";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";

interface TopCoverProps {
  entry: Nullable<PlaylistCacheEntry>;
}

const TopCover: FC<TopCoverProps> = ({ entry }) => {
  const url = entry?.playlist.coverImgUrl;
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
      alt={entry?.playlist.name}
      onLoad={onLoad}
    />
  );
};
export default memo(TopCover);
