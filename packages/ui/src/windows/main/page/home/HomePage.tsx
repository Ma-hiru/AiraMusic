import { type FC, memo, useCallback, useRef } from "react";
import { useScrollAutoHide } from "@mahiru/ui/common/hooks/useScrollAutoHide";
import { useDelay } from "@mahiru/ui/common/hooks/useDelay";
import { useUser } from "@mahiru/ui/common/store/user";
import { useLocateOrScrollTopRegister } from "@mahiru/ui/windows/main/hooks/useLocateOrScrollTopRegister";
import { useArtistOrAlbumPageJump } from "@mahiru/ui/windows/main/hooks/useArtistOrAlbumPageJump";

import Banner from "./banner";
import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./DailyRecommendPlaylist";
import RecommendPlaylist from "./RecommendPlaylist";

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
