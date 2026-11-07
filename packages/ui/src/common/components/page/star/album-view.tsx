import { useMemo, useEffect, useCallback } from "react";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseServicesStar } from "@/common/netease/services";
import { useStarActions } from "@/common/hooks/use-star-actions";
import { useStarCollection } from "@/common/hooks/use-star-collection";
import AppContextMenu from "@/common/components/display/menu";
import type { NeteaseStarAlbum } from "@/common/netease/models";

import { albumToMediaItem } from "./mapper";
import type { StarViewMode } from "./types";
import { createStarContextMenu } from "./menu";
import StarCollectionView from "./collection-view";

interface StarAlbumViewProps {
  active: boolean;
  className?: string;
  refreshToken?: number;
  viewMode?: StarViewMode;
  onClick?: NormalFunc<[id: number]>;
  onCountChange?: NormalFunc<[count: number]>;
}

const fetchAlbums = (offset: number, limit: number, signal: AbortSignal, bypassCache: boolean) =>
  NeteaseServicesStar.albums({ limit, offset }, signal, !bypassCache);

const getAlbumId = (album: NeteaseStarAlbum) => album.id;

const StarAlbumView = ({
  className,
  onClick,
  onCountChange,
  active,
  viewMode,
  refreshToken
}: StarAlbumViewProps) => {
  const { create } = AppContextMenu.useMenu();
  const { unstar } = useStarActions();
  const { data, count, reload, remove, status, hasMore, loadMore } = useStarCollection({
    fetchPage: fetchAlbums,
    getId: getAlbumId,
    active,
    refreshToken,
    pageSize: 30
  });

  useEffect(() => {
    if (status === "success" || data.length > 0) {
      onCountChange?.(Math.max(count, data.length));
    }
  }, [count, data.length, onCountChange, status]);

  const items = useMemo(() => data.map(albumToMediaItem), [data]);

  const onContextItem = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
      const album = data.find((item) => item.id === id);
      if (!album) return;
      e.preventDefault();

      create(createStarContextMenu, {
        clientX: e.clientX,
        clientY: e.clientY,
        name: album.name,
        kindLabel: "专辑",
        coverUrl: album.coverUrl,
        onOpen: () => onClick?.(album.id),
        onUnstar: () => {
          void unstar({
            id: album.id,
            request: () => NeteaseAPIAlbum.star({ id: album.id, t: 0 }),
            onRemoved: () => {
              remove(album.id);
              NeteaseServicesStar.invalidateAlbums();
            },
            onSynced: () => {
              RendererIPCMessageBus.modified.deliver({ type: "album", id: album.id });
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
      emptyTips="还没有收藏的专辑"
      onRetry={reload}
      onClickItem={onClick}
      onLoadMore={loadMore}
      onContextItem={onContextItem}
    />
  );
};

export default StarAlbumView;
