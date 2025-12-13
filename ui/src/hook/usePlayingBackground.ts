import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import { useEffect } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";

export function usePlayingBackground(defaultBg?: string, size: ImageSize = ImageSize.raw) {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const { setBackground } = useLayout();
  const track = trackStatus?.track;

  const cachePlayerCover = useFileCache(
    Filter.NeteaseImageSize(track?.al.picUrl || defaultBg, size)
  );

  useEffect(() => {
    cachePlayerCover && setBackground(cachePlayerCover);
  }, [cachePlayerCover, setBackground]);
}
