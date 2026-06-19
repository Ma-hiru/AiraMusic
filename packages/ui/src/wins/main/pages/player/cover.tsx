import { type FC, memo, type ReactEventHandler, useCallback } from "react";
import { useSetAtom } from "jotai";
import { backgroundCoverAtom, playerBackgroundCoverAtom } from "@/wins/main/atoms/theme";
import RendererPlayerHandle from "@/wins/main/lib/handle";

import NeteaseImage from "@/common/components/display/image/netease-image";

interface CoverProps {
  className?: string;
}

const Cover: FC<CoverProps> = ({ className }) => {
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
    <section className={className}>
      <NeteaseImage
        cache
        preview
        cacheLazy={false}
        image={image}
        title={player.current.track?.detail.al.name ?? player.current.track?.detail.name}
        className="
          size-full rounded-lg hover:scale-101 cursor-pointer
          ease-in-out duration-300 transition-all
        "
        onLoad={onLoad}
        shadowColor="light"
      />
    </section>
  );
};

export default memo(Cover);
