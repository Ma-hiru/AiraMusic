import { type FC, Fragment, memo, useMemo } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";

import RendererPlayerHandle from "@/wins/main/lib/handle";
import NeteaseImage from "@/common/components/image/netease-image";

const BarCover: FC<object> = () => {
  const { jumpArtistPage } = usePageJump();
  const setPlayModal = useSetAtom(playModalAtom);
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;
  const image = useMemo(
    () =>
      track
        ? NeteaseNetworkImage.fromTrackCover(track).setSize(NeteaseImageSize.sm).setAlt(track.name)
        : null,
    [track]
  );

  return (
    <div className="w-full h-2/3 grid grid-cols-[auto_1fr] grid-rows-1 items-center overflow-hidden">
      <NeteaseImage
        cache
        className="h-12 w-12 min-w-12 min-h-12 rounded-md cursor-pointer"
        image={image}
        onClick={() => setPlayModal(true)}
        shadow={track?.al.picUrl ? "base" : "none"}
      />
      <div className="w-full pl-2 pr-6 flex flex-col items-start overflow-hidden">
        <div className="text-sm font-bold text-center truncate">{track?.name}</div>
        <div className="text-xs text-center font-medium truncate opacity-70">
          {track?.ar?.map((a, index) => {
            return (
              <Fragment key={a.id}>
                <span
                  onClick={() => jumpArtistPage(a.id)}
                  className="hover:opacity-50 ease-in-out duration-300 transition-all cursor-pointer">
                  {a.name}
                </span>
                {index !== track.ar.length - 1 && <span> / </span>}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default memo(BarCover);
