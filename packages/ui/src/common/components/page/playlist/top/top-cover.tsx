import { memo, type FC, useMemo, useCallback, type ReactEventHandler } from "react";
import { NeteasePlaylist, NeteaseNetworkImage } from "@/common/netease/models";
import AppModal from "@/common/components/display/modal";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TopCoverProps {
  coverCacheKey?: string;
  summary: Nullable<NeteasePlaylist>;
  onCoverLoaded?: NormalFunc<[src: string]>;
}

const TopCover: FC<TopCoverProps> = ({ onCoverLoaded, summary, coverCacheKey }) => {
  const { create, createPlaylistCoverModal } = AppModal.useModal();

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
  }, [coverCacheKey, create, createPlaylistCoverModal, summary]);

  return (
    <button
      className="size-44 relative group rounded-md"
      type="button"
      disabled={!summary}
      onClick={openCoverModal}>
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25 overflow-hidden rounded-md cursor-pointer" />
      <NeteaseImage className="size-44 rounded-md" image={image} onLoad={onLoad} cache />
    </button>
  );
};

export default memo(TopCover);
