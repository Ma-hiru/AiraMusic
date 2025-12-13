import { FC, memo } from "react";
import BackgroundRender from "@mahiru/ui/componets/player/BackgroundRender";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { Lyric } from "@mahiru/ui/utils/lyric";
import { usePlayerStatus } from "@mahiru/ui/store";

const Background: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  const { playerModalVisible } = useLayout();
  const { hasRaw } = Lyric.getLyricVersionInfo(trackStatus?.lyric);
  const { hasDedicatedGPU } = useGPU();
  const track = trackStatus?.track;
  const cachedBackground = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.lg));
  return hasDedicatedGPU ? (
    <BackgroundRender
      className="absolute inset-0"
      albumIsVideo={false}
      playing={playerModalVisible}
      hasLyric={hasRaw}
      album={cachedBackground}
      staticMode={!playerModalVisible}
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
