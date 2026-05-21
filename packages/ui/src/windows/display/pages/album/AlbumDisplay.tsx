import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@mahiru/ui/common/routes";
import { useUserTrackManager } from "@mahiru/ui/common/hooks/useUserTrackManager";
import { ElectronServicesBus } from "@mahiru/ui/common/source/electron/services";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { useArtistOrAlbumDisplayJump } from "@mahiru/ui/windows/display/hooks/useArtistOrAlbumDisplayJump";
import { usePlayerChangeActionFromDisplay } from "@mahiru/ui/windows/display/hooks/usePlayerChangeActionFromDisplay";
import { useDisplayPageAction } from "@mahiru/ui/windows/display/hooks/useDisplayPageAction";
import ImageConstants from "@mahiru/ui/common/constants/image";

import Album, { type AlbumPageRef } from "@mahiru/ui/common/components/page/album";

const AlbumDisplay: FC<object> = () => {
  const location = useLocation();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const playerBus = useListenable(ElectronServicesBus.player);
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.album);
  const { playableManager, heartManager } = useUserTrackManager();

  const {
    onTrackPlay,
    onReplace,
    onAddList,
    openTrackComment,
    addTrackToPlaylistNext,
    addTrackToPlaylistLast
  } = usePlayerChangeActionFromDisplay({
    getTracks: () => albumRef.current?.album?.tracks ?? [],
    sourceID: id,
    sourceType: "album"
  });
  const { jumpArtistDisplay, jumpAlbumDisplay } = useArtistOrAlbumDisplayJump({
    currentAlbumID: albumRef.current?.album?.content.id
  });
  const { onPageAction } = useDisplayPageAction({
    type: "album",
    id
  });

  return (
    <Album
      id={id}
      ref={albumRef}
      className="w-full h-full"
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={playerBus.data?.track?.id}
      onClick={onTrackPlay}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onAddList={onAddList}
      onPlayAll={onReplace}
      pageActionType="out"
      onPageAction={onPageAction}
      coverSize={ImageConstants.AlbumPageCoverSize}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      openComment={openTrackComment}
    />
  );
};

export default memo(AlbumDisplay);
