import { type FC, memo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RoutePathMain } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useSetAtom } from "jotai";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { scrollActionsAtom, typingAtom } from "@/wins/main/atoms/layout";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { RendererModified } from "@/common/lib/modified";
import { usePlaylistModifySync } from "@/common/hooks/use-playlist-modify-sync";

import Playlist, { type PlaylistRef } from "@/common/components/page/playlist";

const PlaylistPage: FC<object> = () => {
  const user = useUser();
  const location = useLocation();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathMain.playlist.parseQuery(location);

  // 播放曲目
  const {
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    onAddList,
    onReplace,
    onTrackPlay,
    openTrackComment,
    player
  } = usePlayerActionInList(() => playlistRef.current?.totalTracks.current ?? []);
  // 注册滚动和定位回调
  const { canFastLocate, canScrollTop } = useScrollActionsRegister({
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
      source={source}
      user={user}
      className="router-container"
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      onAddList={onAddList}
      onPlay={onTrackPlay}
      onReplace={onReplace}
      onEdited={onEdited}
      onDeleted={onDeleted}
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      addTrackToPlaylist={addTrackToPlaylist}
      addTracksToPlaylist={addTracksToPlaylist}
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={player.current.track?.id}
      canFastLocate={canFastLocate}
      canScrollTop={canScrollTop}
      pageActionType="out"
      onPageAction={onPageAction}
      setIsTyping={setIsTyping}
      onCoverLoaded={setBackground}
    />
  );
};

export default memo(PlaylistPage);
