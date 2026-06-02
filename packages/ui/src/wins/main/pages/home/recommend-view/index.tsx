import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { useUser } from "@/common/store/user";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";

import DailyRecommendTracks from "./daily-recommend-tracks";
import DailyRecommendPlaylist from "./daily-recommend-playlist";
import NewAlbums from "./new-albums";
import RecommendArtists from "./recommend-artists";
import RecommendPlaylist from "./recommend-playlist";
import Toplists from "./toplists";

const HomeRecommendView: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const { jumpPlaylistPage, jumpArtistPage, jumpAlbumPage } = usePageJump();

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {user?.isLoggedIn && (
        <DailyRecommendPlaylist
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
          key={user.profile.userId + "-daily-playlist"}
        />
      )}
      {user?.isLoggedIn && <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />}
      <RecommendPlaylist
        onClickItem={(id) => jumpPlaylistPage(id, "normal")}
        key={user?.isLoggedIn ? user.profile.userId + "-playlist" : "guest-playlist"}
      />
      <RecommendArtists onClickItem={jumpArtistPage} />
      <NewAlbums onClickItem={jumpAlbumPage} />
      <Toplists onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
    </div>
  );
};

export default memo(HomeRecommendView);
