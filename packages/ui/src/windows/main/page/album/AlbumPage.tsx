import { FC, memo, MouseEvent as ReactMouseEvent, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import AppEntry from "@mahiru/ui/windows/main/entry";
import ImageConstants from "@mahiru/ui/windows/main/constants/image";
import AppContextMenu from "@mahiru/ui/public/hooks/useContextMenu";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

import Album, { AlbumPageRef } from "@mahiru/ui/public/components/page/album/AlbumPage";

const AlbumPage: FC<object> = () => {
  const { id } = RoutePath.parseQuery<{ id: number }>(useLocation());
  const { playableManager, heartManager } = useUserTrackManager();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const navigate = useNavigate();

  const player = AppEntry.usePlayer();
  const onPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      const tracks = albumRef.current?.album?.tracks;
      if (!tracks) return;
      if (player.current.track?.id === track.id) return;
      if (player.playlist.same(tracks)) {
        player.playlist.jump(track);
      } else {
        player.playlist.replace(tracks, track);
      }
    },
    [player]
  );
  const addToPlaylistNext = useCallback(
    (track: NeteaseTrackRecord) => {
      player.playlist.add(track, "next");
    },
    [player.playlist]
  );
  const addToPlaylistLast = useCallback(
    (track: NeteaseTrackRecord) => {
      player.playlist.add(track, "end");
    },
    [player.playlist]
  );
  const openComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await ElectronServices.Window.from("comments").openAwait();
    ElectronServices.Bus.comment.send({
      id: track.id,
      type: "track"
    });
  }, []);
  const onReplace = useCallback(() => {
    const tracks = albumRef.current?.album?.tracks;
    if (!tracks) return;
    player.playlist.replace(tracks, 0);
  }, [player.playlist]);
  const onAddList = useCallback(() => {
    const tracks = albumRef.current?.album?.tracks;
    if (!tracks) return;
    player.playlist.addList(tracks);
  }, [player.playlist]);
  // 跳转歌手和专辑页
  const onClickAlbum = useCallback(
    (id: number) => {
      navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
    },
    [navigate]
  );
  const onClickArtist = useCallback(
    (id: number) => {
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate]
  );
  // 右键菜单
  const { create, createTrackContextMenu } = AppContextMenu.use();
  const onContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement, MouseEvent>, track: NeteaseTrackRecord) => {
      create(createTrackContextMenu, {
        track,
        clientX: e.clientX,
        clientY: e.clientY,
        onClick: (type, track) => {
          switch (type) {
            case "play":
              onPlay(track);
              break;
            case "album":
              navigate(RoutePath.withQuery(RoutePathMain.album, { id: track.detail.al.id }));
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
      navigate,
      onPlay,
      openComment
    ]
  );

  return (
    <Album
      id={id}
      ref={albumRef}
      className="router-container"
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={player.current.track?.id}
      onClick={onPlay}
      onClickAlbum={onClickAlbum}
      onClickArtist={onClickArtist}
      onContext={onContextMenu}
      onAddList={onAddList}
      onPlayAll={onReplace}
      coverSize={ImageConstants.AlbumPageCoverSize}
    />
  );
};

export default memo(AlbumPage);
