import { memo, type FC, useMemo, useCallback, type ReactEventHandler } from "react";
import { NeteasePlaylist, NeteaseNetworkImage } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppModal, { createPlaylistCoverModal } from "@/common/components/display/modal";

interface TopCoverProps {
  coverCacheKey?: string;
  summary: Nullable<NeteasePlaylist>;
  onCoverLoaded?: NormalFunc<[src: string]>;
}

const TopCover: FC<TopCoverProps> = ({ onCoverLoaded, summary, coverCacheKey }) => {
  const { create } = AppModal.useModal();

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );
  const image = useMemo(() => {
    return NeteaseNetworkImage.fromPlaylistCover(summary)
      ?.setSize(RendererImageConstants.PlaylistPageCoverSize)
      .setCacheKey(coverCacheKey);
  }, [coverCacheKey, summary]);

  const openCoverModal = useCallback(() => {
    if (!summary) return;
    create(createPlaylistCoverModal, {
      playlist: summary,
      coverCacheKey
    });
  }, [coverCacheKey, create, summary]);

  return (
    <button
      className="group relative aspect-square w-full shrink-0 overflow-hidden rounded-md cursor-pointer focus-visible:ring-2 focus-visible:ring-white/60"
      type="button"
      aria-label="查看歌单详情"
      disabled={!summary}
      onClick={openCoverModal}>
      <NeteaseImage
        className="aspect-square w-full rounded-md"
        image={image}
        imageClassName="transition-transform duration-300 ease-in-out group-hover:scale-103"
        onLoad={onLoad}
        cache
      />
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20 group-focus-visible:bg-black/20" />
    </button>
  );
};

export default memo(TopCover);
