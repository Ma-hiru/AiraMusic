import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseHistoryRecord } from "@/common/netease/models";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionForPlaylistFromDisplay } from "@/wins/display/hooks/use-player-change-action-for-playlist-from-display";
import type { NeteaseTrackRecord } from "@/common/netease/models";
import type { ListeningFootprintProps } from "@/common/components/page/listening-footprint";

type DisplayListeningFootprintProps = Pick<
  ListeningFootprintProps,
  | "active"
  | "onPlay"
  | "openComment"
  | "onClickAlbum"
  | "activeTrackID"
  | "onClickArtist"
  | "historyRecords"
  | "onTracksLoaded"
  | "historyRevision"
  | "addToPlaylistLast"
  | "addToPlaylistNext"
>;

/** 展示窗口读取足迹所需快照，列表播放统一交给 main 执行。 */
export function useDisplayListeningFootprint(
  active = true,
  onJumpPage?: NormalFunc
): DisplayListeningFootprintProps {
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta, !active);
  const historyBus = useListenable(RendererIPCMessageBus.history, !active);
  const tracksRef = useRef<NeteaseTrackRecord[]>([]);
  const historyDataRef = useRef(historyBus.data);
  const [historyRevision, setHistoryRevision] = useState(0);
  const historyRecords = useMemo(
    () => (historyBus.data?.list ?? []).map(NeteaseHistoryRecord.fromHistoryObject),
    [historyBus.data]
  );

  useEffect(() => {
    if (historyDataRef.current === historyBus.data) return;
    historyDataRef.current = historyBus.data;
    setHistoryRevision((revision) => revision + 1);
  }, [historyBus.data]);

  useEffect(() => {
    if (!active) return;
    const request = () => {
      RendererIPCMessageBus.updater.deliver("track-meta");
      RendererIPCMessageBus.updater.deliver("history");
    };
    request();
    return RendererWindow.current.addEventListener("focus", request);
  }, [active]);

  const onTracksLoaded = useCallback((tracks: NeteaseTrackRecord[]) => {
    tracksRef.current = tracks;
  }, []);
  const onPlay = useCallback<NonNullable<ListeningFootprintProps["onPlay"]>>((track) => {
    const tracks = tracksRef.current;
    const index = tracks.findIndex((item) => item.id === track.id);
    if (index < 0) return;
    RendererIPCMessageBus.playlistAction.deliver({
      type: "replacePlaylistAndPlay",
      sourceType: "other",
      detailType: "history",
      sourceID: 0,
      allIDs: tracks.map((item) => item.id),
      trackIdx: index,
      trackID: track.id
    });
  }, []);

  const { addTrackToPlaylistLast, addTrackToPlaylistNext, openTrackComment } =
    usePlayerChangeActionForPlaylistFromDisplay({
      getTracks: () => tracksRef.current,
      sourceID: 0,
      detailType: "history",
      sourceType: "other"
    });
  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump();
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

  return {
    active,
    activeTrackID: trackMetaBus.data?.track?.id,
    historyRecords,
    historyRevision,
    onPlay,
    onTracksLoaded,
    onClickAlbum,
    onClickArtist,
    openComment: openTrackComment,
    addToPlaylistLast: addTrackToPlaylistLast,
    addToPlaylistNext: addTrackToPlaylistNext
  };
}
