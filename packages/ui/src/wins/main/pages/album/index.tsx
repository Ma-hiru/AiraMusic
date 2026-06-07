import { type FC, memo, useRef } from "react";
import { useLocation } from "react-router-dom";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
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
    onAddList
  } = usePlayerActionInList(() => albumRef.current?.album?.tracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = usePageJump({
    currentAlbumID: albumRef.current?.album?.content.id
  });
  const { setBackground } = useSetBackground("album");
  const { onPageAction } = useDisplayAction({
    id: id!,
    type: "album"
  });

  return (
    <Album
      id={id!}
      ref={albumRef}
      className="router-container"
      heartManager={heartManager}
      playableManager={playableManager}
      activeTrackID={player.current.track?.id}
      onClick={onTrackPlay}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      onAddList={onAddList}
      onCoverLoaded={setBackground}
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
