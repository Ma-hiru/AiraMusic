import { useRef, useCallback } from "react";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { NeteaseTrackRecord } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";

/** 从多窗口页面触发播放器变更 */
export function usePlayerChangeActionForPlaylistFromDisplay(props: {
  sourceID: number;
  sourceType: NeteaseTrackRecordSourceType;
  detailType: NeteaseTrackRecordSourceTypeDetail;
  getTracks: NormalFunc<[], NeteaseTrackRecord[]>;
  /** history 不使用标记，因为这些可能是动态的内容, playlist虽然使用了标记，但是main会根据content对比而不完全是markId */
  markId?: string | NormalFunc<[], Undefinable<string>>;
}) {
  const propsRef = useLatestRef(props);
  const lastCurrentMarkId = useRef<Undefinable<string>>(undefined);

  const onTrackPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      const tracks = propsRef.current.getTracks();
      if (!tracks || !tracks[0]) return;
      const markId =
        typeof propsRef.current.markId === "function"
          ? propsRef.current.markId()
          : propsRef.current.markId;

      RendererIPCMessageBus.playlistAction.deliver({
        markId,
        type: "replacePlaylistAndPlay",
        sourceType: track.sourceName,
        trackIdx: tracks.findIndex((t) => t.id === track.id),
        sourceID: track.sourceID,
        trackID: track.id,
        allIDs: tracks.map((t) => t.id),
        detailType: propsRef.current.detailType
      });

      const current_id = RendererIPCMessageBus.trackMeta.data?.playlistMarkId;
      if (!current_id) loadingTips();
      else if (current_id !== markId && lastCurrentMarkId.current !== current_id) {
        window.setTimeout(() => {
          lastCurrentMarkId.current !== current_id && loadingTips();
          lastCurrentMarkId.current = current_id;
        }, 500);
        return;
      }
      lastCurrentMarkId.current = current_id;
    },
    [propsRef]
  );

  const addTrackToPlaylistNext = useCallback((track: NeteaseTrackRecord) => {
    if (!track) return;
    RendererIPCMessageBus.playlistAction.deliver({
      type: "addToPlaylistNext",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);

  const addTrackToPlaylistLast = useCallback((track: NeteaseTrackRecord) => {
    if (!track) return;
    RendererIPCMessageBus.playlistAction.deliver({
      type: "addToPlaylistLast",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);

  const openTrackComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await RendererWindow.comment.reactReadyAwait();
    RendererIPCMessageBus.comment.deliver({
      id: track.id,
      type: "track"
    });
  }, []);

  const onReplace = useCallback(() => {
    const tracks = propsRef.current.getTracks();
    const { sourceID, detailType, sourceType } = propsRef.current;
    if (!tracks || !tracks[0]) return;
    loadingTips();
    RendererIPCMessageBus.playlistAction.deliver({
      sourceID,
      sourceType,
      detailType,
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
    loadingTips();
    RendererIPCMessageBus.playlistAction.deliver({
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

const loadingTips = () => AppToast.show({ type: "info", text: "加载播放列表中..." });
