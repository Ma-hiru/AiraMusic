import { FC, memo, ReactEventHandler, useCallback, useRef } from "react";
import { PlaylistCacheEntry, PlaylistManager } from "@mahiru/ui/utils/playlist";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Headphones } from "lucide-react";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";

interface TopCoverProps {
  entry: Nullable<PlaylistCacheEntry>;
}

const TopCover: FC<TopCoverProps> = ({ entry }) => {
  const { UpdatePlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
  const cacheID = useRef("");

  const onCacheHit = useCallback((_: string, id: string) => {
    cacheID.current = id;
  }, []);
  const onCacheError = useCallback(() => {
    if (cacheID.current) void CacheStore.remove(cacheID.current);
    cacheID.current = "";
  }, []);
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) =>
      UpdatePlayerTheme({
        BackgroundCover: e.currentTarget.src
      }),
    [UpdatePlayerTheme]
  );
  return (
    <div className="size-44 relative select-none">
      <NeteaseImage
        className="size-44 rounded-md"
        src={entry?.playlist.coverImgUrl}
        alt={entry?.playlist.name}
        onLoad={onLoad}
        onCacheHit={onCacheHit}
        onCacheError={onCacheError}
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
