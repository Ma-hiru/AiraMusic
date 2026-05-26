import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { ElectronServicesBus } from "@/common/source/electron/services";
import { useListenable } from "@/common/hooks/use-listenable";
import { useArtistOrAlbumDisplayJump } from "../../../display/hooks/use-artist-or-album-display-jump";
import { usePlayerChangeActionFromDisplay } from "../../../display/hooks/use-player-change-action-from-display";
import { useDisplayPageAction } from "../../../display/hooks/use-display-page-action";
import RendererImageConstants from "@/common/constants/image";

import Album, { type AlbumPageRef } from "@/common/components/page/album";

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
      className="display-container pb-0!"
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
      coverSize={RendererImageConstants.AlbumPageCoverSize}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      openComment={openTrackComment}
    />
  );
};

export default memo(AlbumDisplay);
