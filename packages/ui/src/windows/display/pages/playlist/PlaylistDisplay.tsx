import { FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useUser } from "@mahiru/ui/common/store/user";
import { RoutePathDisplay } from "@mahiru/ui/common/routes";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/useUserTrackManager";
import { ElectronServicesBus } from "@mahiru/ui/common/source/electron/services";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { PlaylistSource } from "@mahiru/ui/common/enum";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/useArtistOrAlbumDisplayJump";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/usePlayerChangeActionFromDisplay";
import { useDisplayPageAction } from "@mahiru/ui/windows/display/hooks/useDisplayPageAction";

import Playlist, { PlaylistRef } from "@mahiru/ui/common/components/page/playlist/Playlist";

const PlaylistDisplay: FC<object> = () => {
  const user = useUser();
  const playlistRef = useRef<Nullable<PlaylistRef>>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { heartManager, playableManager } = useUserTrackManager();
  const { id, source } = RoutePathDisplay.playlist.parseQuery(useLocation());

  const {
    onReplace,
    onTrackPlay,
    onAddList,
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment
  } = usePlayerChangeActionFromDisplay({
    getTracks: () => playlistRef.current?.totalTracks.current ?? [],
    sourceID: Number(id),
    sourceType: "playlist"
  });
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump();
  const { onPageAction } = useDisplayPageAction(() => {
    if (source !== PlaylistSource.Normal && source !== PlaylistSource.Like) return null;
    return {
      type: "playlist",
      id: Number(id),
      source
    };
  });

  return (
    <Playlist
      ref={playlistRef}
      id={id}
      source={source}
      user={user}
      className="w-full h-full"
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onAddList={onAddList}
      onPlay={onTrackPlay}
      onReplace={onReplace}
      openComment={openTrackComment}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
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
