import { FC, memo, MouseEvent as ReactMouseEvent, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay, RoutePathMain } from "@mahiru/ui/public/routes";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import { useBack } from "@mahiru/ui/windows/display/ctx/back";
import AppContextMenu from "@mahiru/ui/public/components/menu";

import Artist, { ArtistRef } from "@mahiru/ui/public/components/page/artist/Artist";

const ArtistDisplay: FC<object> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const playerBus = useListenable(ElectronServicesBus.player);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathDisplay.artist);

  const artistRef = useRef<ArtistRef>(null);
  const onPlay = useCallback((track: NeteaseTrackRecord) => {
    const tracks = artistRef.current?.artist?.hotTracks;
    if (!tracks) return;
    ElectronServicesBus.playerChange.send({
      type: "replacePlaylistAndPlay",
      sourceType: track.sourceName,
      trackIdx: tracks.findIndex((t) => t.id === track.id),
      sourceID: track.sourceID,
      trackID: track.id,
      allIDs: tracks.map((t) => t.id)
    });
  }, []);
  const addToPlaylistNext = useCallback((track: NeteaseTrackRecord) => {
    ElectronServicesBus.playerChange.send({
      type: "addToPlaylistNext",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);
  const addToPlaylistLast = useCallback((track: NeteaseTrackRecord) => {
    ElectronServicesBus.playerChange.send({
      type: "addToPlaylistLast",
      sourceType: track.sourceName,
      sourceID: track.sourceID,
      trackID: track.id
    });
  }, []);
  const openComment = useCallback(async (track: NeteaseTrackRecord) => {
    if (!track) return;
    await ElectronServicesWindow.get("comments").openAwait();
    ElectronServicesBus.comment.send({
      id: track.id,
      type: "track"
    });
  }, []);

  // 跳转歌手和专辑页
  const onClickAlbum = useCallback(
    (id: number) => {
      navigate(RoutePath.withQuery(RoutePathDisplay.album, { id }));
    },
    [navigate]
  );
  const onClickArtist = useCallback(
    (id: number) => {
      navigate(RoutePath.withQuery(RoutePathDisplay.artist, { id }));
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
  const { playableManager, heartManager } = useUserTrackManager();
  const { markBack } = useBack();
  const onPageAction = useCallback(() => {
    ElectronServicesWindow.main.send("mergeDisplay", {
      type: "artist",
      id
    });
    markBack();
    navigate(-1);
  }, [id, markBack, navigate]);
  return (
    <Artist
      ref={artistRef}
      activeTrackID={playerBus.data?.track?.id}
      className="w-full h-full"
      id={id}
      onClick={onPlay}
      onClickAlbum={onClickAlbum}
      onClickArtist={onClickArtist}
      onContext={onContextMenu}
      heartManager={heartManager}
      playableManager={playableManager}
      pageActionType="enter"
      onPageAction={onPageAction}
    />
  );
};

export default memo(ArtistDisplay);
