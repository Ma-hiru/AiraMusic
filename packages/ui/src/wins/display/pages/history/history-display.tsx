import { type FC, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { NeteaseHistoryRecord } from "@/common/netease/models";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { usePlayerChangeActionFromDisplay } from "@/wins/display/hooks/use-player-change-action-from-display";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useDisplayTitle } from "@/wins/display/hooks/use-display-title";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { RendererWindow } from "@/common/lib/window";
import type { TrackListClickFunc } from "@/common/components/display/track_list";

import History, { type HistoryRef } from "@/common/components/page/history";

const HistoryDisplay: FC<object> = () => {
  const historyRef = useRef<Nullable<HistoryRef>>(null);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta);
  const historyBus = useListenable(RendererIPCMessageBus.history);
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

  const { addTrackToPlaylistNext, addTrackToPlaylistLast, openTrackComment } =
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

  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump();
  const { onPageAction } = useDisplayPageAction({ type: "history" });
  const { updateTitle } = useDisplayTitle("history");

  useEffect(
    () => updateTitle(`历史记录 ${historyList.length}条`),
    [historyList.length, updateTitle]
  );

  return (
    <History
      ref={historyRef}
      className="display-container pb-0!"
      historyList={historyList}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onPlay={onTrackPlay}
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={trackMetaBus.data?.track?.id}
      canFastLocate={null}
      canScrollTop={null}
      pageActionType="enter"
      onPageAction={onPageAction}
    />
  );
};

export default memo(HistoryDisplay);

const fetchHistory = () => RendererIPCMessageBus.updater.deliver("history");
