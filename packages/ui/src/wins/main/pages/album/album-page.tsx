import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useArtistOrAlbumPageJump } from "../../../main/hooks/use-artist-or-album-page-jump";
import { usePageAction } from "../../../main/hooks/use-page-action";
import { useCoverLoadedAndSetTheme } from "../../../main/hooks/use-cover-loaded-and-set-theme";
import { usePlayerChangeAction } from "../../../main/hooks/use-player-change-action";
import RendererImageConstants from "@/common/constants/image";

import Album, { type AlbumPageRef } from "@/common/components/page/album";

const AlbumPage: FC<object> = () => {
  const location = useLocation();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.album);
  const { playableManager, heartManager } = useUserTrackManager();

  const {
    player,
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    onTrackPlay,
    openTrackComment,
    onAddList,
    onReplace
  } = usePlayerChangeAction(() => albumRef.current?.album?.tracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = useArtistOrAlbumPageJump({
    currentAlbumID: albumRef.current?.album?.content.id
  });
  const { onCoverLoaded } = useCoverLoadedAndSetTheme();
  const { onPageAction } = usePageAction({
    id,
    type: "album"
  });

  return (
    <Album
      id={id}
      ref={albumRef}
      className="router-container"
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={player.current.track?.id}
      onClick={onTrackPlay}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      onAddList={onAddList}
      onPlayAll={onReplace}
      onCoverLoaded={onCoverLoaded}
      pageActionType="out"
      onPageAction={onPageAction}
      coverSize={RendererImageConstants.AlbumPageCoverSize}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      openComment={openTrackComment}
    />
  );
};

export default memo(AlbumPage);
