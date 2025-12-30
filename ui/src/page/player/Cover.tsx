import { FC, memo, ReactEventHandler, useCallback } from "react";
import { ImageSize } from "@mahiru/ui/utils/filter";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { usePlayerStore } from "@mahiru/ui/store/player";
import { useLayoutStore } from "@mahiru/ui/store/layout";

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
      src={track?.al.picUrl}
      size={ImageSize.raw}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      alt={track?.al?.name || track?.name}
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};
export default memo(Cover);
