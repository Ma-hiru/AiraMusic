import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@/common/store/user";
import { RoutePathMain } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { PlaylistSource } from "@/common/enum";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useLocateOrScrollTopRegister } from "@/wins/main/hooks/use-locate-or-scroll-top-register";
import { useSetAtom } from "jotai";
import { typingAtom } from "@/wins/main/atoms/layout";

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
  const { canFastLocate, canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => playlistRef.current?.scrollTop,
    getFastLocateFunc: () => playlistRef.current?.fastLocator,
    page: "playlist"
  });
  // 跳转歌手和专辑页
  const { jumpAlbumPage, jumpArtistPage } = usePageJump();
  const { onPageAction } = useDisplayAction(() => {
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return null;
    return {
      id: Number(id),
      type: "playlist",
      source
    };
  });
  const { setBackground } = useSetBackground("playlist");

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
      pageActionType="out"
      onPageAction={onPageAction}
      setIsTyping={setIsTyping}
      onCoverLoaded={setBackground}
    />
  );
};

export default memo(PlaylistPage);
