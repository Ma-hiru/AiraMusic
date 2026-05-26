import AppEntry from "@mahiru/ui/windows/main/entry";
import { useCallback } from "react";
import { type TrackListClickFunc } from "@mahiru/ui/common/components/track_list";
import { NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";
import { useLatestRef } from "@mahiru/ui/common/hooks/use-latest-ref";

export function usePlayerChangeAction(getTracks: NormalFunc<[], NeteaseTrackRecord[]>) {
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
    await ElectronServicesWindow.comment.openAwait();
    ElectronServicesBus.comment.send({
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
