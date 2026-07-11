import { memo, type FC, useMemo, useCallback, type ReactEventHandler } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseAlbum, NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppModal, { createAlbumCoverModal } from "@/common/components/display/modal";

interface TopCoverProps {
  coverCacheKey?: string;
  size: NeteaseImageSize;
  album: Nullable<NeteaseAlbum>;
  dynamic: Nullable<NeteaseAPI.NeteaseAlbumDynamicDetailResponse>;
  onCoverLoaded?: NormalFunc<[cover: string]>;
}

const TopCover: FC<TopCoverProps> = ({ onCoverLoaded, size, album, dynamic, coverCacheKey }) => {
  const { create } = AppModal.useModal();
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
  }, [album, cacheKey, create, dynamic]);

  return (
    <button
      className="size-44 relative group"
      type="button"
      disabled={!album}
      onClick={openCoverModal}>
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25 overflow-hidden rounded-md cursor-pointer" />
      <NeteaseImage className="size-44 rounded-md" image={cover} onLoad={onLoaded} cache />
    </button>
  );
};

export default memo(TopCover);
