import AppEntry from "@/wins/main/entry";
import { useCallback } from "react";
import { type TrackListClickFunc } from "@/common/components/track_list";
import { NeteaseTrackRecord } from "@/common/netease/models";
import { RendererWindow } from "@/common/lib/window";
import { RendererEventBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";

export function usePlayerActionInList(getTracks: NormalFunc<[], NeteaseTrackRecord[]>) {
  const player = AppEntry.usePlayer();
  const getTracksRef = useLatestRef(getTracks);

  const onTrackPlay = useCallback<TrackListClickFunc>(
    (track) => {
      const totalTracks = getTracksRef.current();
      if (!totalTracks || !totalTracks[0]) return;
      if (player.current.track?.id === track.id) return;
      if (player.playlist.same(totalTracks)) {
        player.playlist.jump(track);
      } else {
        player.playlist.replace(totalTracks, track);
      }
    },
    [player, getTracksRef]
  );
  const addTrackToPlaylistNext = useCallback(
    (track: NeteaseTrackRecord) => {
      if (!track) return;
      player.playlist.add(track, "next");
    },
    [player.playlist]
  );
  const addTrackToPlaylistLast = useCallback(
    (track: NeteaseTrackRecord) => {
      if (!track) return;
      player.playlist.add(track, "end");
    },
    [player.playlist]
  );

  const openTrackComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererEventBus.comment.send({
      id: track.id,
      type: "track"
    });
  }, []);

  const onReplace = useCallback(() => {
    const tracks = getTracksRef.current();
    player.playlist.replace(tracks, 0);
  }, [player.playlist, getTracksRef]);

  const onAddList = useCallback(() => {
    const tracks = getTracksRef.current();
    player.playlist.addList(tracks);
  }, [player.playlist, getTracksRef]);

  return {
    onTrackPlay,
    addTrackToPlaylistNext,
    addTrackToPlaylistLast,
    openTrackComment,
    onReplace,
    onAddList,
    player
  };
}
