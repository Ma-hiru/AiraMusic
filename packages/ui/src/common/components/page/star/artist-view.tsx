import { useMemo, useEffect, useCallback } from "react";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseServicesStar } from "@/common/netease/services";
import { useStarActions } from "@/common/hooks/use-star-actions";
import { useStarCollection } from "@/common/hooks/use-star-collection";
import AppContextMenu from "@/common/components/display/menu";
import type { NeteaseStarArtist } from "@/common/netease/models";

import type { StarViewMode } from "./types";
import { artistToMediaItem } from "./mapper";
import { createStarContextMenu } from "./menu";
import StarCollectionView from "./collection-view";

interface StarArtistViewProps {
  active: boolean;
  className?: string;
  refreshToken?: number;
  viewMode?: StarViewMode;
  onClick?: NormalFunc<[id: number]>;
  onCountChange?: NormalFunc<[count: number]>;
}

const fetchArtists = (offset: number, limit: number, signal: AbortSignal, bypassCache: boolean) =>
  NeteaseServicesStar.artists({ limit, offset }, signal, !bypassCache);

const getArtistId = (artist: NeteaseStarArtist) => artist.id;

const StarArtistView = ({
  className,
  onClick,
  onCountChange,
  active,
  viewMode,
  refreshToken
}: StarArtistViewProps) => {
  const { create } = AppContextMenu.useMenu();
  const { unstar } = useStarActions();
  const { data, count, reload, remove, status, hasMore, loadMore } = useStarCollection({
    fetchPage: fetchArtists,
    getId: getArtistId,
    active,
    refreshToken,
    pageSize: 30
  });

  useEffect(() => {
    if (status === "success" || data.length > 0) {
      onCountChange?.(Math.max(count, data.length));
    }
  }, [count, data.length, onCountChange, status]);

  const items = useMemo(() => data.map(artistToMediaItem), [data]);

  const onContextItem = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
      const artist = data.find((item) => item.id === id);
      if (!artist) return;
      e.preventDefault();

      create(createStarContextMenu, {
        clientX: e.clientX,
        clientY: e.clientY,
        name: artist.name,
        kindLabel: "歌手",
        coverUrl: artist.coverUrl,
        onOpen: () => onClick?.(artist.id),
        onUnstar: () => {
          void unstar({
            id: artist.id,
            request: () => NeteaseAPIArtist.subscribe(artist.id, 0),
            onRemoved: () => {
              remove(artist.id);
              NeteaseServicesStar.invalidateArtists();
            }
          });
        }
      });
    },
    [create, data, onClick, remove, unstar]
  );

  return (
    <StarCollectionView
      className={className}
      items={items}
      status={status}
      hasMore={hasMore}
      viewMode={viewMode}
      emptyTips="还没有收藏的歌手"
      onRetry={reload}
      onClickItem={onClick}
      onLoadMore={loadMore}
      onContextItem={onContextItem}
    />
  );
};

export default StarArtistView;
