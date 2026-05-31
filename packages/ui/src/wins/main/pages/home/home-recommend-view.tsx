import { type FC, memo } from "react";
import { useUser } from "@/common/store/user";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";

import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./daily-recommend-playlist";
import NewAlbums from "./new-albums";
import RecommendArtists from "./recommend-artists";
import RecommendPlaylist from "./recommend-playlist";
import Toplists from "./toplists";

const HomeRecommendView: FC<object> = () => {
  const user = useUser();
  const { jumpPlaylistPage, jumpArtistPage, jumpAlbumPage } = useArtistOrAlbumPageJump();

  return (
    <div className="flex flex-col gap-8">
      {user?.isLoggedIn && <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />}
      {user?.isLoggedIn && (
        <DailyRecommendPlaylist
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
          key={user.profile.userId + "-daily-playlist"}
        />
      )}
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
