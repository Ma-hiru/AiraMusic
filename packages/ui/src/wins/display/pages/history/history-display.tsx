import { memo, useRef, type FC, useMemo, useEffect, useCallback } from "react";
import { RoutePathDisplay } from "@/common/routes";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseHistoryRecord } from "@/common/netease/models";
import { scrollActionsAtom } from "@/wins/display/atoms/layout";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import History, { type HistoryRef } from "@/common/components/page/history";
import type { TrackListClickFunc } from "@/common/components/display/track_list";

const HistoryDisplay: FC<object> = () => {
  const historyRef = useRef<Nullable<HistoryRef>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const historyBus = useListenable(RendererIPCMessageBus.history);
  const routerActive = useRouterActive(RoutePathDisplay, "history");
  const { heartManager, playableManager } = useUserTrackManager();

  // 进入页面或聚焦时请求 main 窗口推送最新历史
  useEffect(() => {
    fetchHistory();
    return RendererWindow.current.addEventListener("focus", fetchHistory);
  }, []);

  const historyList = useMemo(
    () => (historyBus.data?.list ?? []).map(NeteaseHistoryRecord.fromHistoryObject),
    [historyBus.data]
  );

  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment } =
    usePlayerChangeActionFromDisplay({
      getTracks: () => historyRef.current?.totalTracks.current ?? [],
      sourceID: 0,
      sourceType: "other"
    });

  // 历史记录每条来源不同，整体作为临时列表播放
  const historyListRef = useLatestRef(historyList);
  const onTrackPlay = useCallback<TrackListClickFunc>(
    (track) => {
      const tracks = historyListRef.current;
      if (!tracks.length) return;
      RendererIPCMessageBus.playlistAction.deliver({
        type: "replacePlaylistAndPlay",
        sourceType: "other",
        sourceID: 0,
        trackID: track.id,
        trackIdx: tracks.findIndex((t) => t.id === track.id),
        allIDs: tracks.map((t) => t.id)
      });
    },
    [historyListRef]
  );

  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump();
  const { onPageAction } = useDisplayPageAction({ type: "history" });
  const { setTitle } = useDisplayTitleRegister("history", "历史记录");
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  // 注册滚动和定位回调（display 窗口）
  const active = useRouterActive(RoutePathDisplay, "history");
  const { canScrollTop, canFastLocate } = useScrollActionsRegister({
    active,
    atom: scrollActionsAtom,
    getScrollTopFunc: () => historyRef.current?.scrollTop,
    getFastLocateFunc: () => historyRef.current?.fastLocator
  });

  useEffect(() => setTitle(`历史记录 ${historyList.length}条`), [historyList.length, setTitle]);

  return (
    <History
      ref={historyRef}
      className="display-container pb-0!"
      pageActionType="enter"
      historyList={historyList}
      canScrollTop={canScrollTop}
      heartManager={heartManager}
      routerActive={routerActive}
      canFastLocate={canFastLocate}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      activeTrackID={trackMetaBus.data?.track?.id}
      onPlay={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
    />
  );
};

export default memo(HistoryDisplay);

const fetchHistory = () => RendererIPCMessageBus.updater.deliver("history");
