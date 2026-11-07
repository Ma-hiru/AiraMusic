import { useRef, useMemo, useEffect, useCallback } from "react";
import { userStoreSnapshot } from "@/common/store/user";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesStar } from "@/common/netease/services";
import { useStarActions } from "@/common/hooks/use-star-actions";
import AppContextMenu from "@/common/components/display/menu";
import type { NeteaseUser } from "@/common/netease/models";

import type { StarViewMode } from "./types";
import { playlistToMediaItem } from "./mapper";
import { createStarContextMenu } from "./menu";
import StarCollectionView from "./collection-view";

interface StarPlaylistViewProps {
  user: NeteaseUser;
  className?: string;
  refreshToken?: number;
  viewMode?: StarViewMode;
  onClick?: NormalFunc<[id: number]>;
  onCountChange?: NormalFunc<[count: number]>;
}

const noop = () => {};

/** 收藏的歌单来自用户 store，不需要分页请求 */
const StarPlaylistView = ({
  user,
  className,
  onClick,
  onCountChange,
  viewMode,
  refreshToken
}: StarPlaylistViewProps) => {
  const { create } = AppContextMenu.useMenu();
  const { unstar } = useStarActions();
  const playlists = useMemo(() => NeteaseServicesStar.playlists(user), [user]);
  const items = useMemo(() => playlists.map(playlistToMediaItem), [playlists]);
  const refreshTokenRef = useRef(refreshToken);

  useEffect(() => {
    onCountChange?.(playlists.length);
  }, [onCountChange, playlists.length]);

  // 歌单刷新 = 让主窗口重新拉取用户歌单
  useEffect(() => {
    if (refreshToken === undefined || refreshToken === refreshTokenRef.current) return;
    refreshTokenRef.current = refreshToken;
    RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
  }, [refreshToken]);

  const onContextItem = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
      const playlist = playlists.find((item) => item.id === id);
      if (!playlist) return;
      e.preventDefault();

      create(createStarContextMenu, {
        clientX: e.clientX,
        clientY: e.clientY,
        name: playlist.name,
        kindLabel: "歌单",
        coverUrl: playlist.coverImgUrl,
        onOpen: () => onClick?.(playlist.id),
        onUnstar: () => {
          void unstar({
            id: playlist.id,
            request: () => NeteaseAPIPlaylist.star({ id: playlist.id, t: 2 }),
            onRemoved: () => {
              const latest = userStoreSnapshot()._user;
              if (!latest) return;
              userStoreSnapshot().updateUser({
                ...latest,
                starPlaylists: (latest.starPlaylists ?? []).filter(
                  (item) => item.id !== playlist.id
                )
              });
            },
            onSynced: () => {
              RendererIPCMessageBus.modified.twoWay({ type: "user-playlist" });
              RendererIPCMessageBus.modified.deliver({
                type: "playlist-update",
                id: playlist.id,
                source: "normal"
              });
            }
          });
        }
      });
    },
    [create, onClick, playlists, unstar]
  );

  return (
    <StarCollectionView
      className={className}
      items={items}
      hasMore={false}
      status="success"
      viewMode={viewMode}
      emptyTips="还没有收藏的歌单"
      onRetry={noop}
      onLoadMore={noop}
      onClickItem={onClick}
      onContextItem={onContextItem}
    />
  );
};

export default StarPlaylistView;
