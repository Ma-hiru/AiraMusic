import { FC, memo, SyntheticEvent, useCallback, useRef } from "react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playlist";
import { CacheStore } from "@mahiru/ui/store/cache";
import { useLayoutStatus } from "@mahiru/ui/store";
import { Headphones } from "lucide-react";

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
    <div className="size-44 relative">
      <img
        className="w-full h-full rounded-md shadow-xs select-none"
        src={cachedCover}
        loading="lazy"
        decoding="async"
        alt={entry?.playlist.name}
        onLoad={onLoad}
        onError={onImageError}
      />
      <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10 select-none">
        <Headphones className="size-3" />
        <p className="text-[10px] align-middle">
          {PlaylistManager.formatPlayCount(entry?.playlist.playCount)}
        </p>
      </div>
    </div>
  );
};
export default memo(TopCover);
