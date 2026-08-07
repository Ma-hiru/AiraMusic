import { useLocation } from "react-router-dom";
import { memo, useRef, type FC, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { RendererModified } from "@/common/lib/modified";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useAlbumModifySync } from "@/common/hooks/use-album-modify-sync";
import { useUserTrackManager } from "@/common/hooks/use-user-track-manager";
import { useTrackAddToPlaylist } from "@/common/hooks/use-track-add-to-playlist";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import RendererImageConstants from "@/common/constants/image";
import Album, { type AlbumPageRef } from "@/common/components/page/album";

const AlbumPage: FC<object> = () => {
  const user = useUser();
  const location = useLocation();
  const albumRef = useRef<Nullable<AlbumPageRef>>(null);
  const routerActive = useRouterActive(RoutePathMain, "album");
  const { id } = RoutePath.parseQuery<{ id: number }>(location, RoutePathMain.album);
  const { heartManager, playableManager } = useUserTrackManager();
  const { onEdited } = useAlbumModifySync(id ?? null);

  const {
    addTrackToPlaylistLast,
    addTrackToPlaylistNext,
    openTrackComment,
    onAddList,
    onTrackPlay,
    player
  } = usePlayerActionInList(() => albumRef.current?.album?.tracks ?? []);
  const { jumpAlbumPage, jumpArtistPage } = usePageJump({
    currentAlbumID: albumRef.current?.album?.content.id
  });
  const { setBackground } = useSetBackground("album");
  const { onPageAction } = useDisplayAction({
    id: id!,
    type: "album"
  });
  const { addTrackToPlaylist } = useTrackAddToPlaylist();

  useEffect(() => {
    if (!id) return;
    return RendererModified.listen(
      {
        type: "album",
        id
      },
      () => albumRef.current?.reload()
    );
  }, [id]);

  return (
    <Album
      ref={albumRef}
      id={id!}
      className="router-container"
      user={user}
      pageActionType="out"
      heartManager={heartManager}
      routerActive={routerActive}
      openComment={openTrackComment}
      playableManager={playableManager}
      addTrackToPlaylist={addTrackToPlaylist}
      activeTrackID={player.current.track?.id}
      addToPlaylistLast={addTrackToPlaylistLast}
      addToPlaylistNext={addTrackToPlaylistNext}
      coverSize={RendererImageConstants.AlbumPageCoverSize}
      onEdited={onEdited}
      onAddList={onAddList}
      onClick={onTrackPlay}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumPage}
      onCoverLoaded={setBackground}
      onClickArtist={jumpArtistPage}
    />
  );
};

export default memo(AlbumPage);
