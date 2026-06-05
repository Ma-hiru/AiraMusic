import { type FC, memo, type ReactEventHandler, useCallback } from "react";
import { useSetAtom } from "jotai";
import { playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import RendererPlayerHandle from "@/wins/main/lib/handle";

import NeteaseImage from "@/common/components/image/netease-image";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";

const Cover: FC<object> = () => {
  const { setBackground } = useSetBackground();
  const setPlayerBackgroundCover = useSetAtom(playerBackgroundCoverAtom);
  const player = RendererPlayerHandle.usePlayer();
  const image = player.current.cover;

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      setPlayerBackgroundCover(e.currentTarget.src);
      setBackground(e.currentTarget.src);
    },
    [setBackground, setPlayerBackgroundCover]
  );

  return (
    <NeteaseImage
      cache
      preview
      cacheLazy={false}
      image={image}
      className="w-full h-full rounded-lg ease-in-out duration-300 transition-all select-none"
      onLoad={onLoad}
      shadowColor="light"
    />
  );
};

export default memo(Cover);
