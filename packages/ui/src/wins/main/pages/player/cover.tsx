import { useSetAtom } from "jotai";
import { memo, type FC, useCallback, type ReactEventHandler } from "react";
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
        className="
          size-full rounded-lg hover:scale-101 cursor-pointer
          ease-in-out duration-300 transition-all
        "
        image={image}
        cacheLazy={false}
        shadowColor="light"
        title={player.current.track?.detail.al.name ?? player.current.track?.detail.name}
        onLoad={onLoad}
        cache
        preview
      />
    </section>
  );
};

export default memo(Cover);
