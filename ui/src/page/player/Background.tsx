import { FC, memo } from "react";
import { BackgroundRender } from "@mahiru/ui/componets/player/BackgroundRender";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";

const Background: FC<object> = () => {
  const { info, lyricLines } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  const hasLyrics = lyricLines.raw.length > 0;
  const { hasDedicatedGPU } = useGPU();
  const cachedBackground = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.lg));
  return hasDedicatedGPU ? (
    <BackgroundRender
      className="absolute inset-0"
      renderScale={hasDedicatedGPU ? 0.5 : 0.35}
      flowSpeed={hasDedicatedGPU ? 2 : 1}
      albumIsVideo={false}
      fps={PlayerModalVisible ? (hasDedicatedGPU ? 30 : 15) : 0}
      playing={PlayerModalVisible}
      hasLyric={hasLyrics}
      album={cachedBackground}
      staticMode={!PlayerModalVisible}
    />
  ) : (
    <AcrylicBackground
      className="absolute inset-0"
      src={cachedBackground}
      brightness={0.5}
      opacity={0.5}
    />
  );
};
export default memo(Background);
