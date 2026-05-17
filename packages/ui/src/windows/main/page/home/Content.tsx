import { FC, memo, useCallback, useRef } from "react";
import { useScrollAutoHide } from "@mahiru/ui/common/hooks/useScrollAutoHide";
import { useDelay } from "@mahiru/ui/common/hooks/useDelay";
import { useUser } from "@mahiru/ui/common/store/user";
import { cx } from "@emotion/css";
import { useLocateOrScrollTopRegister } from "@mahiru/ui/windows/main/hooks/useLocateOrScrollTopRegister";

import Banner from "./banner";
import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./daily_recommend_playlist";
import RecommendPlaylist from "./recommend_playlist";

const Content: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const delay = useDelay([200, 1000, 3000, 5000]);
  const user = useUser();
  useScrollAutoHide(containerRef);

  const scrollTop = useCallback(() => {
    console.log("exec");
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const { canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => scrollTop
  });

  return (
    <div
      ref={containerRef}
      className={cx(`w-full h-full overflow-y-auto scrollbar will-change-scroll contain-strict`)}
      onScroll={(e) => canScrollTop(e.currentTarget.scrollTop > 500)}>
      {delay(200) && <Banner />}
      {delay(1000) && user?.isLoggedIn && (
        <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />
      )}
      {delay(3000) && user?.isLoggedIn && (
        <DailyRecommendPlaylist key={user.profile.userId + "-daily-playlist"} />
      )}
      {user?.isLoggedIn
        ? delay(5000) && <RecommendPlaylist key={user.profile.userId + "-playlist"} />
        : delay(1000) && <RecommendPlaylist />}
    </div>
  );
};
export default memo(Content);
