import { type FC, memo, useCallback, useRef } from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useDelay } from "@/common/hooks/use-delay";
import { useUser } from "@/common/store/user";
import { useLocateOrScrollTopRegister } from "@/wins/main/hooks/use-locate-or-scroll-top-register";
import { useArtistOrAlbumPageJump } from "@/wins/main/hooks/use-artist-or-album-page-jump";

import Banner from "./banner";
import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./daily-recommend-playlist";
import RecommendPlaylist from "./recommend-playlist";

const HomePage: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const delay = useDelay([200, 1000, 3000, 5000]);
  const user = useUser();
  useScrollAutoHide(containerRef);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const { canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => scrollTop
  });
  const { jumpPlaylistPage } = useArtistOrAlbumPageJump();

  return (
    <div
      ref={containerRef}
      onScroll={(e) => canScrollTop(e.currentTarget.scrollTop > 500)}
      className={`
        router-container overflow-y-auto scrollbar pb-10
        will-change-scroll contain-strict text-(--text-color-on-main)
      `}>
      {delay(200) && <Banner />}
      {delay(1000) && user?.isLoggedIn && (
        <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />
      )}
      {delay(3000) && user?.isLoggedIn && (
        <DailyRecommendPlaylist
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
          key={user.profile.userId + "-daily-playlist"}
        />
      )}
      {user?.isLoggedIn
        ? delay(5000) && (
            <RecommendPlaylist
              onClickItem={(id) => jumpPlaylistPage(id, "normal")}
              key={user.profile.userId + "-playlist"}
            />
          )
        : delay(1000) && <RecommendPlaylist onClickItem={(id) => jumpPlaylistPage(id, "normal")} />}
    </div>
  );
};

export default memo(HomePage);
