import { useCallback } from "react";
import { NeteaseTrackRecord } from "@/common/netease/models";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@/common/components/display/track_list";
import AppContextMenu from "@/common/components/display/menu";

/** 歌曲右键菜单 */
export function useTrackContextMenu(props: {
  onPlay: TrackListClickFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
}) {
  const { onPlay, onClickAlbum, addToPlaylistNext, addToPlaylistLast, openComment } = props;
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();

  const onContextMenu = useCallback<TrackListContextMenuFunc>(
    (e, track) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        onClick: (type, track) => {
          switch (type) {
            case "play":
              onPlay(track, /** unused */ 0);
              break;
            case "album":
              onClickAlbum(track.detail.al.id);
              break;
            case "nextPlay":
              addToPlaylistNext(track);
              break;
            case "addPlayList":
              addToPlaylistLast(track);
              break;
            case "comment":
              void openComment(track);
              break;
          }
        }
      });
    },
    [
      addToPlaylistLast,
      addToPlaylistNext,
      create,
      createTrackContextMenu,
      onClickAlbum,
      onPlay,
      openComment
    ]
  );

  return {
    onContextMenu
  };
}
