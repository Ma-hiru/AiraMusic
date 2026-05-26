import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@mahiru/ui/common/store/user";
import { RoutePathMain } from "@mahiru/ui/common/routes";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/use-user-track-manager";
import { PlaylistSource } from "@mahiru/ui/common/enum";
import { useArtistOrAlbumPageJump } from "@mahiru/ui/windows/main/hooks/use-artist-or-album-page-jump";
import { usePageAction } from "@mahiru/ui/windows/main/hooks/use-page-action";
import { usePlayerChangeAction } from "@mahiru/ui/windows/main/hooks/use-player-change-action";
import { useCoverLoadedAndSetTheme } from "@mahiru/ui/windows/main/hooks/use-cover-loaded-and-set-theme";
import { useLocateOrScrollTopRegister } from "@mahiru/ui/windows/main/hooks/use-locate-or-scroll-top-register";
import { useSetAtom } from "jotai";
import { typingAtom } from "@mahiru/ui/windows/main/atoms/layout";

import Playlist, { type PlaylistRef } from "@mahiru/ui/common/components/page/playlist";

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
  } = usePlayerChangeAction(() => playlistRef.current?.totalTracks.current ?? []);
  // 注册滚动和定位回调
  const { canFastLocate, canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => playlistRef.current?.scrollTop,
    getFastLocateFunc: () => playlistRef.current?.fastLocator
  });
  // 跳转歌手和专辑页
  const { jumpAlbumPage, jumpArtistPage } = useArtistOrAlbumPageJump();
  const { onPageAction } = usePageAction(() => {
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return null;
    return {
      id: Number(id),
      type: "playlist",
      source
    };
  });
  const { onCoverLoaded } = useCoverLoadedAndSetTheme();

  const setIsTyping = useSetAtom(typingAtom);

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
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
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
