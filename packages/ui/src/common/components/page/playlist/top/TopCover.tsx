import { type FC, memo, type ReactEventHandler, useCallback, useMemo } from "react";
import { Headphones } from "lucide-react";
import { NeteaseNetworkImage, NeteasePlaylist } from "../../../../source/netease/models";
import ImageConstants from "@mahiru/ui/common/constants/image";

import NeteaseImage from "../../../../components/image/NeteaseImage";

interface TopCoverProps {
  summary: Nullable<NeteasePlaylist>;
  coverCacheKey?: string;
  onCoverLoaded?: NormalFunc<[src: string]>;
}

const TopCover: FC<TopCoverProps> = ({ summary, coverCacheKey, onCoverLoaded }) => {
  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );
  const image = useMemo(
    () =>
      NeteaseNetworkImage.fromPlaylistCover(summary)
        ?.setSize(ImageConstants.PlaylistPageCoverSize)
        .setCacheKey(coverCacheKey),
    [summary, coverCacheKey]
  );

  return (
    <div className="size-44 relative select-none">
      <NeteaseImage cache preview image={image} className="size-44 rounded-md" onLoad={onLoad} />
      <div className="absolute right-1 top-1 flex gap-1 justify-center items-center text-white z-10 select-none">
        <Headphones className="size-3" />
        <p className="text-[10px] align-middle">{summary?.playCountFormat()}</p>
      </div>
    </div>
  );
};
export default memo(TopCover);
