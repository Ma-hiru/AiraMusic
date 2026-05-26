import { useCallback } from "react";
import { NeteaseTrackRecord } from "@/common/source/netease/models";
import { ElectronServicesBus, ElectronServicesWindow } from "@/common/source/electron/services";
import { useLatestRef } from "@/common/hooks/use-latest-ref";

/** 从多窗口页面触发播放器变更 */
export function usePlayerChangeActionFromDisplay(props: {
  getTracks: NormalFunc<[], NeteaseTrackRecord[]>;
  sourceID: number;
  sourceType: NeteaseTrackRecordSourceType;
}) {
  const propsRef = useLatestRef(props);

  const onTrackPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      const tracks = propsRef.current.getTracks();
      if (!tracks || !tracks[0]) return;
      ElectronServicesBus.playerChange.send({
        type: "replacePlaylistAndPlay",
        sourceType: track.sourceName,
        trackIdx: tracks.findIndex((t) => t.id === track.id),
        sourceID: track.sourceID,
        trackID: track.id,
        allIDs: tracks.map((t) => t.id)
      });
    },
    [propsRef]
  );

  const addTrackToPlaylistNext = useCallback((track: NeteaseTrackRecord) => {
    if (!track) return;
    ElectronServicesBus.playerChange.send({
      type: "addToPlaylistNext",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);

  const addTrackToPlaylistLast = useCallback((track: NeteaseTrackRecord) => {
    if (!track) return;
    ElectronServicesBus.playerChange.send({
      type: "addToPlaylistLast",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);

  const openTrackComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await ElectronServicesWindow.comment.openAwait();
    ElectronServicesBus.comment.send({
      id: track.id,
      type: "track"
    });
  }, []);

  const onReplace = useCallback(() => {
    const tracks = propsRef.current.getTracks();
    const { sourceID, sourceType } = propsRef.current;
    if (!tracks || !tracks[0]) return;
    ElectronServicesBus.playerChange.send({
      sourceID,
      sourceType,
      type: "replacePlaylistAndPlay",
      trackIdx: 0,
      trackID: tracks[0].id,
      allIDs: tracks.map((t) => t.id)
    });
  }, [propsRef]);

  const onAddList = useCallback(() => {
    const tracks = propsRef.current.getTracks();
    const { sourceID, sourceType } = propsRef.current;
    if (!tracks || !tracks[0]) return;
    ElectronServicesBus.playerChange.send({
      sourceID,
      sourceType,
      type: "addListToPlaylistEnd",
      allIDs: tracks.map((t) => t.id)
    });
  }, [propsRef]);

  return {
    onTrackPlay,
    addTrackToPlaylistNext,
    addTrackToPlaylistLast,
    openTrackComment,
    onReplace,
    onAddList
  };
}
