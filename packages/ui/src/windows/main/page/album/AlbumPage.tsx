import { FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/common/routes";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/useUserTrackManager";
import { useArtistOrAlbumPageJump } from "@mahiru/ui/windows/main/hooks/useArtistOrAlbumPageJump";
import { usePageAction } from "@mahiru/ui/windows/main/hooks/usePageAction";
import { useCoverLoadedAndSetTheme } from "@mahiru/ui/windows/main/hooks/useCoverLoadedAndSetTheme";
import { usePlayerChangeAction } from "@mahiru/ui/windows/main/hooks/usePlayerChangeAction";
import ImageConstants from "@mahiru/ui/common/constants/image";

import Album, { AlbumPageRef } from "@mahiru/ui/common/components/page/album/Album";

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
      coverSize={ImageConstants.AlbumPageCoverSize}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      openComment={openTrackComment}
    />
  );
};

export default memo(AlbumPage);
