import { FC, memo, useEffect, useRef } from "react";
import BackgroundRender from "@mahiru/ui/componets/player/BackgroundRender";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { useDevice } from "@mahiru/ui/hook/useDevice";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { NeteaseLyric } from "@mahiru/ui/utils/lyric";
import { PlayerFSMStatusEnum, usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { NeteaseImage, NeteaseImageSize } from "@mahiru/ui/utils/image";

const Background: FC<object> = () => {
  const { PlayerFSMStatus, PlayerTrackStatus } = usePlayerStore([
    "PlayerTrackStatus",
    "PlayerFSMStatus"
  ]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  const { hasRaw } = NeteaseLyric.getLyricVersionInfo(PlayerTrackStatus?.lyric);
  const { gpu } = useDevice();
  const firstRender = useRef(true);

  const track = PlayerTrackStatus?.track;
  const cachedBackground = useFileCache(
    NeteaseImage.setSize(track?.al.picUrl, NeteaseImageSize.lg)
  );

  useEffect(() => {
    if (PlayerVisible && firstRender.current) {
      firstRender.current = false;
    }
  }, [PlayerVisible]);

  return gpu.dedicated ? (
    <BackgroundRender
      className="absolute inset-0"
      albumIsVideo={false}
      // 初次渲染未打开播放器模态框时强制开启动画，避免背景懒加载时的空白
      playing={
        firstRender.current
          ? true
          : PlayerVisible && PlayerFSMStatus === PlayerFSMStatusEnum.playing
      }
      hasLyric={hasRaw}
      album={cachedBackground}
      staticMode={!PlayerVisible}
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
