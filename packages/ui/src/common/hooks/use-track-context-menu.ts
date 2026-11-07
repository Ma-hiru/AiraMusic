import { useCallback } from "react";
import { NeteaseTrackRecord } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import AppContextMenu from "@/common/components/display/menu";
import AppModal, { createTrackInfoModal } from "@/common/components/display/modal";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@/common/components/display/track_list";

/** 歌曲右键菜单 */
export function useTrackContextMenu(props: {
  onPlay: TrackListClickFunc;
  onClickAlbum: NormalFunc<[id: number]>;
  /** 提供后菜单才显示「查看歌手」 */
  onClickArtist?: NormalFunc<[id: number]>;
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
    onClickArtist,
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
        onClickArtist,
        onClick: (type, target) => {
          switch (type) {
            case "play":
              onPlay(target, /** unused */ 0);
              break;
            case "album":
              onClickAlbum(target.detail.al.id);
              break;
            case "info":
              // 菜单也用于弹窗内部，替换内容时不接管宿主弹窗的生命周期。
              AppModal._create(createTrackInfoModal, { track: target });
              break;
            case "nextPlay":
              addToPlaylistNext(target);
              AppToast.show({
                type: "info",
                text: "已添加到下一首播放"
              });
              break;
            case "addPlayList":
              addToPlaylistLast(target);
              AppToast.show({
                type: "info",
                text: "已添加到播放列表"
              });
              break;
            case "comment":
              void openComment(target);
              break;
            case "favPlaylist":
              addTrackToPlaylist?.(target);
              break;
            case "removeFromPlaylist":
              removeFromPlaylist?.(target);
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
      onClickArtist,
      onPlay,
      openComment,
      removeFromPlaylist
    ]
  );

  return {
    onContextMenu
  };
}
