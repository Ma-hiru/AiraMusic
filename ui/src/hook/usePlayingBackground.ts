import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useEffect } from "react";

export function usePlayingBackground(defaultBg?: string, size: ImageSize = ImageSize.raw) {
  const { trackStatus } = usePlayer();
  const track = trackStatus?.track;
  const { setBackground } = useLayout();
  const cachePlayerCover = useFileCache(
    Filter.NeteaseImageSize(track?.al.picUrl || defaultBg, size)
  );
  useEffect(() => {
    cachePlayerCover && setBackground(cachePlayerCover);
  }, [cachePlayerCover, setBackground]);
}
