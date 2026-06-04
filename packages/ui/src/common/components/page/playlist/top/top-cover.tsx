import { type FC, memo, type ReactEventHandler, useCallback, useMemo } from "react";
import { NeteaseNetworkImage, NeteasePlaylist } from "@/common/netease/models";
import RendererImageConstants from "@/common/constants/image";

import NeteaseImage from "@/common/components/image/netease-image";
import AppModal from "@/common/components/modal";

interface TopCoverProps {
  summary: Nullable<NeteasePlaylist>;
  coverCacheKey?: string;
  onCoverLoaded?: NormalFunc<[src: string]>;
}

const TopCover: FC<TopCoverProps> = ({ summary, coverCacheKey, onCoverLoaded }) => {
  const { create, createPlaylistCoverModal } = AppModal.useModal();

  const onLoad = useCallback<ReactEventHandler<HTMLImageElement>>(
    (e) => {
      onCoverLoaded?.(e.currentTarget.src);
    },
    [onCoverLoaded]
  );
  const image = useMemo(() => {
    const cacheKey =
      (coverCacheKey ?? "") + (summary?.updateTime ?? "") + (summary?.trackIds[0] ?? "");
    return NeteaseNetworkImage.fromPlaylistCover(summary)
      ?.setSize(RendererImageConstants.PlaylistPageCoverSize)
      .setCacheKey(cacheKey);
  }, [summary, coverCacheKey]);

  const openCoverModal = useCallback(() => {
    if (!summary) return;
    create(createPlaylistCoverModal, {
      playlist: summary,
      coverCacheKey
    });
  }, [coverCacheKey, create, createPlaylistCoverModal, summary]);

  return (
    <button
      type="button"
      disabled={!summary}
      onClick={openCoverModal}
      className="size-44 relative group rounded-md">
      <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/25 overflow-hidden rounded-md cursor-pointer" />
      <NeteaseImage cache image={image} className="size-44 rounded-md" onLoad={onLoad} />
    </button>
  );
};

export default memo(TopCover);
