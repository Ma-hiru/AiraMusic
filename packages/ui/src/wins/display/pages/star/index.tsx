import { memo, type FC, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RoutePathDisplay } from "@/common/routes";
import { RendererWindow } from "@/common/lib/window";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import { useDisplayPageAction } from "@/wins/display/hooks/use-display-page-action";
import { useArtistOrAlbumDisplayJump } from "@/wins/display/hooks/use-artist-or-album-display-jump";
import Star from "@/common/components/page/star";

const StarDisplay: FC<object> = () => {
  const user = useUser();
  const routerActive = useRouterActive(RoutePathDisplay, "star");
  const { onPageAction } = useDisplayPageAction({ type: "star" });
  const { jumpAlbumDisplay, jumpArtistDisplay, jumpPlaylistDisplay } =
    useArtistOrAlbumDisplayJump();

  useDisplayTitleRegister("star", "收藏");

  const onLogin = useCallback(() => {
    RendererWindow.main.send("message_dispatch_need_login", true);
  }, []);

  return (
    <Star
      className="display-container pb-0!"
      user={user}
      pageActionType="enter"
      routerActive={routerActive}
      onLogin={onLogin}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumDisplay}
      onClickArtist={jumpArtistDisplay}
      onClickPlaylist={jumpPlaylistDisplay}
    />
  );
};

export default memo(StarDisplay);
