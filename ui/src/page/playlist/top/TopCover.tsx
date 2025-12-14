import { FC, memo, SyntheticEvent, useCallback, useRef } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { CacheStore } from "@mahiru/ui/store/cache";
import { useLayoutStatus } from "@mahiru/ui/store";

interface TopCoverProps {
  entry: Nullable<PlaylistCacheEntry>;
}

const TopCover: FC<TopCoverProps> = ({ entry }) => {
  const { setBackground } = useLayoutStatus(["setBackground"]);
  const url = entry?.playlist.coverImgUrl;
  const sizedURL = Filter.NeteaseImageSize(url, ImageSize.lg);
  const cacheID = useRef("");

  const cachedCover = useFileCache(sizedURL, {
    onCacheHit: (_, id) => {
      cacheID.current = id;
    }
  });

  const onLoad = useCallback(() => {
    setBackground(cachedCover);
  }, [cachedCover, setBackground]);
  const onImageError = useCallback(
    (e: SyntheticEvent<HTMLImageElement>) => {
      const raw = Filter.NeteaseImageSize(url, ImageSize.lg)!;
      if (e.currentTarget.src === raw) return;
      e.currentTarget.src = raw;
      if (cacheID.current) void CacheStore.remove(cacheID.current);
      cacheID.current = "";
    },
    [url]
  );

  return (
    <img
      className="size-44 rounded-md shadow-xs select-none"
      src={cachedCover}
      loading="lazy"
      decoding="async"
      alt={entry?.playlist.name}
      onLoad={onLoad}
      onError={onImageError}
    />
  );
};
export default memo(TopCover);
