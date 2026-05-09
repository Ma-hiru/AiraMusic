import { FC, memo, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { useRouterActive } from "@mahiru/ui/public/hooks/useRouterActive";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";

import Artist, { ArtistRef } from "@mahiru/ui/public/components/page/artist/Artist";

const ArtistPage: FC<object> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const active = useRouterActive(location);
  const avatarRef = useRef("");
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.artist);

  const onAvatarLoadedData = useCallback((avatar: string) => {
    const { updateTheme, theme } = getLayoutStoreSnapshot();
    updateTheme(theme.copy().setBackgroundCover(avatar));
    avatarRef.current = avatar;
  }, []);

  useEffect(() => {
    const avatar = avatarRef.current;
    avatar && onAvatarLoadedData(avatar);
  }, [active, onAvatarLoadedData]);

  const artistRef = useRef<ArtistRef>(null);
  const player = AppEntry.usePlayer();
  const onPlay = useCallback(
    (track: NeteaseTrackRecord) => {
      const tracks = artistRef.current?.artist?.hotTracks;
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

  // 跳转歌手和专辑页
  const onClickAlbum = useCallback(
    (id: number) => {
      navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
    },
    [navigate]
  );
  const onClickArtist = useCallback(
    (id: number) => {
      if (id === artistRef.current?.artist?.id) return;
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate]
  );

  const { playableManager, heartManager } = useUserTrackManager();

  const onPageAction = useCallback(async () => {
    await ElectronServicesWindow.get("display").openAwait();
    ElectronServicesBus.display.send({
      id,
      type: "artist"
    });
    navigate(-1);
  }, [id, navigate]);

  return (
    <Artist
      ref={artistRef}
      activeTrackID={player.current.track?.id}
      className="router-container"
      id={id}
      onAvatarLoaded={onAvatarLoadedData}
      onClick={onPlay}
      onClickAlbum={onClickAlbum}
      onClickArtist={onClickArtist}
      heartManager={heartManager}
      playableManager={playableManager}
      pageActionType="out"
      onPageAction={onPageAction}
      addToPlaylistNext={addToPlaylistNext}
      addToPlaylistLast={addToPlaylistLast}
      openComment={openComment}
    />
  );
};

export default memo(ArtistPage);
