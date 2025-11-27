import { FC, memo } from "react";
import { BackgroundRender } from "@mahiru/ui/componets/player/BackgroundRender";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";

const Background: FC<object> = () => {
  const { info, lyricLines, isPlaying } = usePlayer();
  const { PlayerModalVisible } = useLayout();
  const hasLyrics = lyricLines.raw.length > 0;
  const { hasDedicatedGPU } = useGPU();
  const cachedBackground = useFileCache(NeteaseImageSizeFilter(info.cover, ImageSize.lg));
  return (
    <BackgroundRender
      style={{
        position: "absolute",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%"
      }}
      renderScale={hasDedicatedGPU ? 0.5 : 0.35}
      flowSpeed={hasDedicatedGPU ? 2 : 1}
      albumIsVideo={false}
      fps={PlayerModalVisible ? (hasDedicatedGPU ? 30 : 15) : 0}
      playing={isPlaying && PlayerModalVisible}
      hasLyric={hasLyrics}
      album={cachedBackground}
      staticMode={!PlayerModalVisible}
    />
  );
};
export default memo(Background);
