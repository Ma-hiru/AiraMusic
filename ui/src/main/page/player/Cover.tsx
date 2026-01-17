import { FC, memo, ReactEventHandler, useCallback } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

import NeteaseImage from "@mahiru/ui/public/components/public/NeteaseImage";

const Cover: FC<object> = () => {
  const { PlayerTrackStatus } = usePlayerStore(["PlayerTrackStatus"]);
  const { UpdatePlayerTheme } = useLayoutStore(["UpdatePlayerTheme"]);
  const track = PlayerTrackStatus?.track;
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      UpdatePlayerTheme({
        BackgroundCover: e.currentTarget.src
      });
    },
    [UpdatePlayerTheme]
  );
  return (
    <NeteaseImage
      preview
      src={track?.al.picUrl}
      size={NeteaseImageSize.lg}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      alt={track?.al?.name || track?.name}
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};
export default memo(Cover);
