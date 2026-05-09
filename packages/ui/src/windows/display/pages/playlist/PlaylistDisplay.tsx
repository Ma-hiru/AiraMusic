import { FC, memo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUser } from "@mahiru/ui/public/store/user";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/public/routes";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import Playlist, { PlaylistRef } from "@mahiru/ui/public/components/page/playlist/Playlist";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import { useBack } from "@mahiru/ui/windows/display/ctx/back";
import { PlaylistSource } from "@mahiru/ui/public/enum";

const PlaylistDisplay: FC<object> = () => {
  const user = useUser();
  const navigate = useNavigate();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathDisplay.playlist.parseQuery(useLocation());
  // 播放曲目
  const onPlay = useCallback((track: NeteaseTrackRecord) => {
    const tracks = playlistRef.current?.totalTracks.current;
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
  const onReplace = useCallback(() => {
    const tracks = playlistRef.current?.totalTracks.current;
    if (!tracks || !tracks[0]) return;
    ElectronServicesBus.playerChange.send({
      type: "replacePlaylistAndPlay",
      sourceType: "playlist",
      trackIdx: 0,
      sourceID: Number(id),
      trackID: tracks[0].id,
      allIDs: tracks.map((t) => t.id)
    });
  }, [id]);
  const onAddList = useCallback(() => {
    const tracks = playlistRef.current?.totalTracks.current;
    if (!tracks) return;
    ElectronServicesBus.playerChange.send({
      type: "addListToPlaylistEnd",
      sourceType: "playlist",
      sourceID: Number(id),
      allIDs: tracks.map((t) => t.id)
    });
  }, [id]);

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

  const { markBack } = useBack();
  const onPageAction = useCallback(async () => {
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return;
    ElectronServicesWindow.main.send("mergeDisplay", {
      type: "playlist",
      id: Number(id),
      source
    });
    markBack();
    navigate(-1);
  }, [id, markBack, navigate, source]);

  return (
    <Playlist
      ref={playlistRef}
      id={id}
      source={source}
      user={user}
      className="w-full h-full"
      onClickAlbum={onClickAlbum}
      onClickArtist={onClickArtist}
      onAddList={onAddList}
      onPlay={onPlay}
      onReplace={onReplace}
      openComment={openComment}
      addToPlaylistLast={addToPlaylistLast}
      addToPlaylistNext={addToPlaylistNext}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={playerBus.data?.track?.id}
      canFastLocate={null}
      canScrollTop={null}
      pageActionType="enter"
      onPageAction={onPageAction}
      historyList={[]}
    />
  );
};

export default memo(PlaylistDisplay);
