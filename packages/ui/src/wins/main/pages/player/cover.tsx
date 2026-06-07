import { type FC, memo, type ReactEventHandler, useCallback } from "react";
import { useSetAtom } from "jotai";
import { backgroundCoverAtom, playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import RendererPlayerHandle from "@/wins/main/lib/handle";

import NeteaseImage from "@/common/components/display/image/netease-image";

const Cover: FC<object> = () => {
  const setBackgroundCover = useSetAtom(backgroundCoverAtom);
  const setPlayerBackgroundCover = useSetAtom(playerBackgroundCoverAtom);
  const player = RendererPlayerHandle.usePlayer();
  const image = player.current.cover;

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      setPlayerBackgroundCover(e.currentTarget.src);
      setBackgroundCover(e.currentTarget.src);
    },
    [setBackgroundCover, setPlayerBackgroundCover]
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
