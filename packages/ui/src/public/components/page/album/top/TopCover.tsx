import { FC, memo, useMemo } from "react";
import { NeteaseAlbum, NeteaseNetworkImage } from "@mahiru/ui/public/source/netease/models";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

interface TopCoverProps {
  album: Nullable<NeteaseAlbum>;
  coverCacheKey?: string;
  size: NeteaseImageSize;
}

const TopCover: FC<TopCoverProps> = ({ album, coverCacheKey, size }) => {
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
      />
    </div>
  );
};
export default memo(TopCover);
