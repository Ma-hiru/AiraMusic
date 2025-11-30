import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useEffect } from "react";

export function usePlayingBackground(defaultBg?: string, size: ImageSize = ImageSize.raw) {
  const { info } = usePlayer();
  const { setBackground } = useLayout();
  const cachePlayerCover = useFileCache(NeteaseImageSizeFilter(info.cover || defaultBg, size));
  useEffect(() => {
    cachePlayerCover && setBackground(cachePlayerCover);
  }, [cachePlayerCover, setBackground]);
}
