import { useSetAtom } from "jotai";
import { useLocation } from "react-router-dom";
import { memo, useRef, type FC, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { RoutePathMain } from "@/common/routes";
import { RendererModified } from "@/common/lib/modified";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { typingAtom, scrollActionsAtom } from "@/wins/main/atoms/layout";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { usePlaylistModifySync } from "@/common/hooks/use-playlist-modify-sync";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import Playlist, { type PlaylistRef } from "@/common/components/page/playlist";

const PlaylistPage: FC<object> = () => {
  const user = useUser();
  const location = useLocation();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const routerActive = useRouterActive(RoutePathMain, "playlist");
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathMain.playlist.parseQuery(location);

  // 播放曲目
  const {
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment,
    onAddList,
    onReplace,
    onTrackPlay,
    player
  } = usePlayerActionInList(() => playlistRef.current?.totalTracks.current ?? []);
  // 注册滚动和定位回调
  const { canScrollTop, canFastLocate } = useScrollActionsRegister({
    atom: scrollActionsAtom,
    active: useRouterActive(RoutePathMain, "playlist"),
    getScrollTopFunc: () => playlistRef.current?.scrollTop,
    getFastLocateFunc: () => playlistRef.current?.fastLocator
  });
  // 跳转歌手和专辑页
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();
  const { onPageAction } = useDisplayAction(() => {
    if (source !== "normal" && source !== "like") return null;
    return {
      id: Number(id),
      type: "playlist",
      source
    };
  });
  const { setBackground } = useSetBackground("playlist");
  // 当前歌单不应出现
  const { addTrackToPlaylist, addTracksToPlaylist } = useTrackAddToPlaylist(
    source === "normal" && id ? Number(id) : undefined
  );
  // 通过 ipc 同步歌单修改时的重载
  const { onEdited, onDeleted } = usePlaylistModifySync(id, source);

  const setIsTyping = useSetAtom(typingAtom);

  useEffect(() => {
    if (!id && !source) return;
    return RendererModified.listen(
      {
        type: "playlist",
        id,
        source
      },
      () => playlistRef.current?.reload()
    );
  }, [id, source]);

  return (
    <Playlist
      ref={playlistRef}
      id={id}
      className="router-container"
      user={user}
      source={source}
      pageActionType="out"
      setIsTyping={setIsTyping}
      canScrollTop={canScrollTop}
      heartManager={heartManager}
      routerActive={routerActive}
      canFastLocate={canFastLocate}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      activeTrackID={player.current.track?.id}
      addTracksToPlaylist={addTracksToPlaylist}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      onEdited={onEdited}
      onPlay={onTrackPlay}
      onAddList={onAddList}
      onDeleted={onDeleted}
      onReplace={onReplace}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumPage}
      onCoverLoaded={setBackground}
      onClickArtist={jumpArtistPage}
    />
  );
};

export default memo(PlaylistPage);
