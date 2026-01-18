import { FC, memo, useEffect, useRef } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useFileCache } from "@mahiru/ui/public/hooks/useFileCache";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";

const Background: FC<object> = () => {
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
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

  return (
    <AcrylicBackground
      className="absolute inset-0"
      src={cachedBackground}
      brightness={0.6}
      opacity={0.5}
      blur={60}
    />
  );
  //   <BackgroundRender
  //     className="absolute inset-0"
  //     albumIsVideo={false}
  //     // 初次渲染未打开播放器模态框时强制开启动画，避免背景懒加载时的空白
  //     playing={
  //       firstRender.current
  //         ? true
  //         : PlayerVisible && PlayerFSMStatus === PlayerFSMStatusEnum.playing
  //     }
  //     hasLyric={hasRaw}
  //     album={cachedBackground}
  //     staticMode={!PlayerVisible}
  //   />
};
export default memo(Background);
