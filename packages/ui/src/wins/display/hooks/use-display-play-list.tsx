import { useMemo, useEffect, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { useListenable } from "@/common/hooks/use-listenable";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import DisplayPlayListProgress from "@/wins/display/components/play-list-progress";
import type { PlayListQueueProps } from "@/common/components/page/play-list";

/** 展示窗口只接收队列快照，播放操作交回 main 的现有队列。 */
export function useDisplayPlayList(active = true, onJumpPage?: NormalFunc): PlayListQueueProps {
  const playListBus = useListenable(RendererIPCMessageBus.playList, !active);
  const positionBus = useListenable(RendererIPCMessageBus.playListPosition, !active);
  const trackMetaBus = useListenable(RendererIPCMessageBus.trackMeta, !active);
  const tracks = useMemo(
    () => (playListBus.data?.list ?? []).map(NeteaseTrackRecord.fromRecordObject),
    [playListBus.data?.list]
  );
  const activeTrack = useMemo(
    () =>
      trackMetaBus.data?.track
        ? NeteaseTrackRecord.fromRecordObject(trackMetaBus.data.track)
        : null,
    [trackMetaBus.data?.track]
  );
  const { jumpAlbumDisplay, jumpArtistDisplay } = useArtistOrAlbumDisplayJump();
  const snapshot = playListBus.data;
  const position = positionBus.data;
  const activeIndex =
    snapshot &&
    position?.version === snapshot.version &&
    position.senderId === snapshot.senderId &&
    position.markId === snapshot.markId &&
    position.sequence > snapshot.sequence
      ? position.position
      : (snapshot?.position ?? -1);

  useEffect(() => {
    if (!active) return;
    const request = () => {
      RendererIPCMessageBus.updater.deliver("play-list");
      RendererIPCMessageBus.updater.deliver("track-meta");
      RendererIPCMessageBus.updater.deliver("track-progress");
    };
    request();
    return RendererWindow.current.addEventListener("focus", request);
  }, [active]);

  const onPlay = useCallback<PlayListQueueProps["onPlay"]>((track) => {
    RendererIPCMessageBus.playlistAction.deliver({ type: "playTrack", trackID: track.id });
  }, []);
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
  const openComment = useCallback<PlayListQueueProps["openComment"]>(async (track) => {
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({ type: "track", id: track.id });
  }, []);
  const addToPlaylistLast = useCallback<PlayListQueueProps["addToPlaylistLast"]>((track) => {
    RendererIPCMessageBus.playlistAction.deliver({
      type: "addToPlaylistLast",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);
  const addToPlaylistNext = useCallback<PlayListQueueProps["addToPlaylistNext"]>((track) => {
    RendererIPCMessageBus.playlistAction.deliver({
      type: "addToPlaylistNext",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);

  return {
    tracks,
    activeTrack,
    activeIndex,
    status: trackMetaBus.data?.status ?? "idle",
    progress: <DisplayPlayListProgress active={active} />,
    active,
    onPlay,
    onClickAlbum,
    onClickArtist,
    openComment,
    addToPlaylistLast,
    addToPlaylistNext
  };
}
