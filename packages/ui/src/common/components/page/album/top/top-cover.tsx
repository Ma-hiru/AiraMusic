import { type FC, memo, type ReactEventHandler, useCallback, useMemo } from "react";
import { NeteaseAlbum, NeteaseNetworkImage } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";
import NeteaseImage from "@/common/components/image/netease-image";
import AppModal from "@/common/components/modal";

interface TopCoverProps {
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  coverCacheKey?: string;
  size: NeteaseImageSize;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const TopCover: FC<TopCoverProps> = ({ album, dynamic, coverCacheKey, size, onCoverLoaded }) => {
  const onLoaded: ReactEventHandler<HTMLImageElement> = useCallback(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );
  const cover = useMemo(
    () => NeteaseNetworkImage.fromAlbumCover(album)?.setSize(size).setCacheKey(coverCacheKey),
    [album, coverCacheKey, size]
  );
  const { create, createAlbumCoverModal } = AppModal.useModal();
  const openCoverModal = useCallback(() => {
    if (!album || !dynamic) return;
    create(createAlbumCoverModal, {
      album,
      dynamic,
      coverCacheKey
    });
  }, [album, coverCacheKey, create, createAlbumCoverModal, dynamic]);
  return (
    <button
      type="button"
      disabled={!album}
      onClick={openCoverModal}
      className="size-44 relative select-none hover:scale-102 ease-in-out transition-all duration-300">
      <NeteaseImage cache image={cover} className="size-44 rounded-md" onLoad={onLoaded} />
    </button>
  );
};

export default memo(TopCover);
