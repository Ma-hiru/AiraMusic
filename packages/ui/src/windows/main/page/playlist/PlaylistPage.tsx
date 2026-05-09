import { FC, memo, useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { useUser } from "@mahiru/ui/public/store/user";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { useUserTrackManager } from "@mahiru/ui/public/hooks/useUserTrackManager";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";
import { TrackListClickFunc } from "@mahiru/ui/public/components/track_list";
import Playlist, { PlaylistRef } from "@mahiru/ui/public/components/page/playlist/Playlist";
import { useRouterActive } from "@mahiru/ui/public/hooks/useRouterActive";
import { PlaylistSource } from "@mahiru/ui/public/enum";

const PlaylistPage: FC<object> = () => {
  const user = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathMain.playlist.parseQuery(location);

  // 播放曲目
  const player = AppEntry.usePlayer();
  const onPlay = useCallback<TrackListClickFunc>(
    (track) => {
      const totalTracks = playlistRef.current?.totalTracks.current ?? [];
      if (player.current.track?.id === track.id) return;
      if (player.playlist.same(totalTracks)) {
        player.playlist.jump(track);
      } else {
        player.playlist.replace(totalTracks, track);
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
    await ElectronServicesWindow.get("comments").openAwait();
    ElectronServicesBus.comment.send({
      id: track.id,
      type: "track"
    });
  }, []);
  const onReplace = useCallback(() => {
    const tracks = playlistRef.current?.tracks ?? [];
    player.playlist.replace(tracks, 0);
  }, [player.playlist]);
  const onAddList = useCallback(() => {
    const tracks = playlistRef.current?.tracks ?? [];
    player.playlist.addList(tracks);
  }, [player.playlist]);
  // 注册滚动和定位回调
  const canScrollTop = useCallback((enable: boolean) => {
    const layout = getLayoutStoreSnapshot().layout;
    const updateLayout = getLayoutStoreSnapshot().updateLayout;
    const scrollTop = playlistRef.current?.scrollTop;
    if (layout.scrollTop() !== scrollTop && enable) {
      updateLayout(layout.copy().setScrollTop(scrollTop));
    } else if (layout.scrollTop() !== undefined && !enable) {
      updateLayout(layout.copy().setScrollTop(undefined));
    }
  }, []);
  const canFastLocate = useCallback((enable: boolean) => {
    const layout = getLayoutStoreSnapshot().layout;
    const fastLocator = playlistRef.current?.fastLocator;
    const updateLayout = getLayoutStoreSnapshot().updateLayout;
    if (layout.fastLocator() !== fastLocator && enable) {
      updateLayout(layout.copy().setFastLocator(fastLocator));
    } else if (layout.fastLocator() !== undefined && !enable) {
      updateLayout(layout.copy().setFastLocator(undefined));
    }
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
      navigate(RoutePath.withQuery(RoutePathMain.artist, { id }));
    },
    [navigate]
  );

  const onPageAction = useCallback(async () => {
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return;
    await ElectronServicesWindow.get("display").openAwait();
    ElectronServicesBus.display.send({
      id: Number(id),
      type: "playlist",
      source
    });
    navigate(-1);
  }, [id, navigate, source]);

  const active = useRouterActive(location);
  const coverRef = useRef("");
  const onCoverLoaded = useCallback((src: string) => {
    const { theme, updateTheme } = getLayoutStoreSnapshot();
    updateTheme(theme.copy().setBackgroundCover(src));
    coverRef.current = src;
  }, []);
  useEffect(() => {
    const cover = coverRef.current;
    cover && onCoverLoaded(cover);
  }, [onCoverLoaded, active]);

  const setIsTyping = useCallback((typing: boolean) => {
    const { other, updateOther } = getLayoutStoreSnapshot();
    updateOther(other.copy().setTyping(typing));
  }, []);

  return (
    <Playlist
      ref={playlistRef}
      id={id}
      source={source}
      user={user}
      className="router-container"
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
      activeTrackID={player.current.track?.id}
      canFastLocate={canFastLocate}
      canScrollTop={canScrollTop}
      pageActionType={source === PlaylistSource.History ? "none" : "out"}
      onPageAction={onPageAction}
      setIsTyping={setIsTyping}
      onCoverLoaded={onCoverLoaded}
      historyList={player.history.list}
    />
  );
};

export default memo(PlaylistPage);
