import { useCallback } from "react";
import { NeteaseTrackRecord } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import AppContextMenu from "@/common/components/display/menu";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@/common/components/display/track_list";

/** 歌曲右键菜单 */
export function useTrackContextMenu(props: {
  onPlay: TrackListClickFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  removeFromPlaylist?: NormalFunc<[track: NeteaseTrackRecord]>;
}) {
  const {
    addToPlaylistLast,
    addToPlaylistNext,
    addTrackToPlaylist,
    openComment,
    onPlay,
    onClickAlbum,
    removeFromPlaylist
  } = props;
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();

  const onContextMenu = useCallback<TrackListContextMenuFunc>(
    (e, track) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        canRemove: !!removeFromPlaylist,
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
              AppToast.show({
                type: "info",
                text: "已添加到下一首播放"
              });
              break;
            case "addPlayList":
              addToPlaylistLast(track);
              AppToast.show({
                type: "info",
                text: "已添加到播放列表"
              });
              break;
            case "comment":
              void openComment(track);
              break;
            case "favPlaylist":
              addTrackToPlaylist?.(track);
              break;
            case "removeFromPlaylist":
              removeFromPlaylist?.(track);
              break;
          }
        }
      });
    },
    [
      addToPlaylistLast,
      addToPlaylistNext,
      addTrackToPlaylist,
      create,
      createTrackContextMenu,
      onClickAlbum,
      onPlay,
      openComment,
      removeFromPlaylist
    ]
  );

  return {
    onContextMenu
  };
}
