import { memo, type FC, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayAction } from "@/wins/main/hooks/use-display-action";
import Star from "@/common/components/page/star";

const StarPage: FC<object> = () => {
  const user = useUser();
  const routerActive = useRouterActive(RoutePathMain, "star");
  const { jumpAlbumPage, jumpArtistPage, jumpPlaylistPage } = usePageJump();
  const { onPageAction } = useDisplayAction({ type: "star" });

  const onLogin = useCallback(() => {
    void NeteaseServicesAuth.createLoginWindow();
  }, []);

  return (
    <Star
      className="router-container"
      user={user}
      pageActionType="out"
      routerActive={routerActive}
      onLogin={onLogin}
      onPageAction={onPageAction}
      onClickAlbum={jumpAlbumPage}
      onClickArtist={jumpArtistPage}
      onClickPlaylist={(id) => void jumpPlaylistPage(id, "normal")}
    />
  );
};

export default memo(StarPage);
