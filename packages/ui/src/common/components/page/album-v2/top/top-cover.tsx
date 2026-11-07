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
      className="group relative aspect-square w-full shrink-0 cursor-pointer overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-white/60"
      type="button"
      aria-label="查看专辑详情"
      disabled={!album || !dynamic}
      onClick={openCoverModal}>
      <NeteaseImage
        className="aspect-square w-full rounded-md"
        image={cover}
        imageClassName="transition-transform duration-300 ease-in-out group-hover:scale-103"
        onLoad={onLoaded}
        cache
      />
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20 group-focus-visible:bg-black/20" />
    </button>
  );
};

export default memo(TopCover);
