import { useRef, useEffect, useCallback, type RefObject } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { playlistMarkId } from "@/common/utils/playlist-mark-id";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionForPlaylistFromDisplay } from "@/wins/display/hooks/use-player-change-action-for-playlist-from-display";
import RendererImageConstants from "@/common/constants/image";
import type { SearchRef, SearchProps } from "@/common/components/page/search";

type DisplaySearchProps = Omit<SearchProps, "ref" | "variant" | "className" | "defaultKeyword">;

type DisplaySearchOptions = {
  /** 是否订阅播放器快照，页面在路由未命中时关闭订阅 */
  active?: boolean;
  /** 是否向 Agent 上报搜索上下文，抽屉不占用路由因此传 false */
  routerActive?: boolean;
  /** 外部共享的 ref，用于抽屉内容向调用方回传当前关键词 */
  searchRef?: RefObject<Nullable<SearchRef>>;
  /** 跳转歌手/专辑/歌单后执行，抽屉用它关闭自身 */
  onJumpPage?: NormalFunc;
};

/** 展示窗口的搜索数据流：页面与抽屉共用，播放统一交回 main 执行。 */
export function useDisplaySearch({
  onJumpPage,
  active = true,
  routerActive = active,
  searchRef: externalRef
}: DisplaySearchOptions = {}): {
  props: DisplaySearchProps;
  searchRef: RefObject<Nullable<SearchRef>>;
} {
  const innerRef = useRef<SearchRef>(null);
  const searchRef = externalRef ?? innerRef;
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta, !active);
  const { heartManager, playableManager } = useUserTrackManager();
  const { jumpAlbumDisplay, jumpArtistDisplay, jumpPlaylistDisplay } =
    useArtistOrAlbumDisplayJump();
  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment, onTrackPlay } =
    usePlayerChangeActionForPlaylistFromDisplay({
      getTracks: () => searchRef.current?.tracks ?? [],
      sourceID: 0,
      sourceType: "other",
      detailType: "search",
      markId: () => playlistMarkId({ type: "search", keyword: searchRef.current?.currentKeyword })
    });
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  // 与队列、足迹一致：激活时主动拉一次快照，避免窗口启动早于 main 推送时高亮为空。
  useEffect(() => {
    if (!active) return;
    const request = () => RendererIPCMessageBus.updater.deliver("track-meta");
    request();
    return RendererWindow.current.addEventListener("focus", request);
  }, [active]);

  const onClickAlbum = useCallback(
    (id: number) => {
      jumpAlbumDisplay(id);
      onJumpPage?.();
    },
    [jumpAlbumDisplay, onJumpPage]
  );
  const onClickArtist = useCallback(
    (id: number) => {
      jumpArtistDisplay(id);
      onJumpPage?.();
    },
    [jumpArtistDisplay, onJumpPage]
  );
  const onClickPlaylist = useCallback(
    (id: number) => {
      jumpPlaylistDisplay(id);
      onJumpPage?.();
    },
    [jumpPlaylistDisplay, onJumpPage]
  );

  return {
    searchRef,
    props: {
      routerActive,
      activeTrackID: trackMetaBus.data?.track?.id,
      heartManager,
      playableManager,
      addToPlaylistLast: addTrackToPlaylistLast,
      addToPlaylistNext: addTrackToPlaylistNext,
      addTrackToPlaylist,
      openComment: openTrackComment,
      onClickAlbum,
      onClickArtist,
      onClickPlaylist,
      onClickTrack: onTrackPlay,
      coverSize: RendererImageConstants.PlaylistPageTrackCoverSize
    }
  };
}
