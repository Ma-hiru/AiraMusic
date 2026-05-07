import { FC, memo, ReactEventHandler, useCallback, useMemo } from "react";
import { NeteaseAlbum, NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

interface TopCoverProps {
  album: Nullable<NeteaseAlbum>;
  coverCacheKey?: string;
  size: NeteaseImageSize;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const TopCover: FC<TopCoverProps> = ({ album, coverCacheKey, size, onCoverLoaded }) => {
  const onLoaded: ReactEventHandler<HTMLImageElement> = useCallback(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );
  return (
    <div className="size-44 relative select-none">
      <NeteaseImage
        cache
        preview
        image={useMemo(
          () => NeteaseNetworkImage.fromAlbumCover(album)?.setSize(size).setCacheKey(coverCacheKey),
          [album, coverCacheKey, size]
        )}
        className="size-44 rounded-md"
        onLoad={onLoaded}
      />
    </div>
  );
};
export default memo(TopCover);
