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
  const { create, createAlbumCoverModal } = AppModal.useModal();
  const cacheKey =
    (coverCacheKey ?? "") + (album?.content.publishTime ?? "") + (album?.tracks[0]?.id ?? "");

  const onLoaded: ReactEventHandler<HTMLImageElement> = useCallback(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );

  const cover = useMemo(
    () => NeteaseNetworkImage.fromAlbumCover(album)?.setSize(size).setCacheKey(cacheKey),
    [album, cacheKey, size]
  );

  const openCoverModal = useCallback(() => {
    if (!album || !dynamic) return;
    create(createAlbumCoverModal, {
      album,
      dynamic,
      coverCacheKey: cacheKey
    });
  }, [album, cacheKey, create, createAlbumCoverModal, dynamic]);

  return (
    <button
      type="button"
      disabled={!album}
      onClick={openCoverModal}
      className="size-44 relative group">
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25 overflow-hidden rounded-md cursor-pointer" />
      <NeteaseImage cache image={cover} className="size-44 rounded-md" onLoad={onLoaded} />
    </button>
  );
};

export default memo(TopCover);
