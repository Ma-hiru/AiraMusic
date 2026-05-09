import { FC, memo, MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";
import ImageConstants from "@mahiru/ui/public/constants/image";
import AppContextMenu from "@mahiru/ui/public/components/menu";

import Album, { AlbumPageRef } from "@mahiru/ui/public/components/page/album/Album";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { useRouterActive } from "@mahiru/ui/public/hooks/useRouterActive";

const AlbumPage: FC<object> = () => {
  const location = useLocation();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const navigate = useNavigate();
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.album);
  const { playableManager, heartManager } = useUserTrackManager();

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
      if (player.current.track?.id === track.id) return;
      player.playlist.add(track, "next");
    },
    [player]
  );
  const addToPlaylistLast = useCallback(
    (track: NeteaseTrackRecord) => {
      if (player.current.track?.id === track.id) return;
      player.playlist.add(track, "end");
    },
    [player]
  );
  const openComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await ElectronServicesWindow.get("comments").openAwait();
    ElectronServicesBus.comment.send({
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
  const { create, createTrackContextMenu } = AppContextMenu.useMenu();
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

  const active = useRouterActive(location);
  const coverRef = useRef("");
  const onCoverLoaded = useCallback((cover: string) => {
    const { theme, updateTheme } = getLayoutStoreSnapshot();
    updateTheme(theme.copy().setBackgroundCover(cover));
    coverRef.current = cover;
  }, []);
  useEffect(() => {
    active && onCoverLoaded(coverRef.current);
  }, [active, onCoverLoaded]);

  const onPageAction = useCallback(async () => {
    await ElectronServicesWindow.get("display").openAwait();
    ElectronServicesBus.display.send({
      id,
      type: "album"
    });
    navigate(-1);
  }, [id, navigate]);

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
      onCoverLoaded={onCoverLoaded}
      pageActionType="out"
      onPageAction={onPageAction}
      coverSize={ImageConstants.AlbumPageCoverSize}
    />
  );
};

export default memo(AlbumPage);
