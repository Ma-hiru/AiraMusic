import { FC, memo, useEffect, useRef } from "react";
import BackgroundRender from "@mahiru/ui/componets/player/BackgroundRender";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { LyricManager } from "@mahiru/ui/utils/lyricManager";
import { usePlayerStatus } from "@mahiru/ui/store";

const Background: FC<object> = () => {
  const { trackStatus, playerStatus, playerModalVisible } = usePlayerStatus([
    "trackStatus",
    "playerModalVisible",
    "playerStatus"
  ]);
  const { hasRaw } = LyricManager.getLyricVersionInfo(trackStatus?.lyric);
  const { hasDedicatedGPU } = useGPU();
  const firstRender = useRef(true);

  const track = trackStatus?.track;
  const cachedBackground = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.lg));

  useEffect(() => {
    if (playerModalVisible && firstRender.current) {
      firstRender.current = false;
    }
  }, [playerModalVisible]);

  return hasDedicatedGPU ? (
    <BackgroundRender
      className="absolute inset-0"
      albumIsVideo={false}
      // 初次渲染未打开播放器模态框时强制开启动画，避免背景懒加载时的空白
      playing={firstRender.current ? true : playerModalVisible && playerStatus.playing}
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
