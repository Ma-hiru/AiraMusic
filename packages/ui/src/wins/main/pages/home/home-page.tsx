import { type FC, memo, useCallback, useRef, useState } from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useLocateOrScrollTopRegister } from "@/wins/main/hooks/use-locate-or-scroll-top-register";

import Banner from "./banner";
import ForYouPanel from "./for-you-panel";
import HomeChannelTabs from "./home-channel-tabs";
import HomeChartsView from "./home-charts-view";
import HomePlaylistsView from "./home-playlists-view";
import HomeRecommendView from "./home-recommend-view";
import HomeSongsArtistsView from "./home-songs-artists-view";
import { type HomeChannelKey } from "./home-config";

const HomePage: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeChannel, setActiveChannel] = useState<HomeChannelKey>("recommend");
  useScrollAutoHide(containerRef);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const { canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => scrollTop
  });

  const changeChannel = useCallback((key: HomeChannelKey) => {
    setActiveChannel(key);
  }, []);

  return (
    <div
      ref={containerRef}
      onScroll={(e) => canScrollTop(e.currentTarget.scrollTop > 500)}
      className={`
        router-container overflow-y-auto scrollbar px-2 pb-10
        will-change-scroll contain-strict text-(--text-color-on-main)
      `}>
      <div className="flex flex-col gap-6">
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
          <Banner />
          <ForYouPanel />
        </section>
        <HomeChannelTabs active={activeChannel} onChange={changeChannel} />
        {activeChannel === "recommend" && <HomeRecommendView />}
        {activeChannel === "charts" && <HomeChartsView />}
        {activeChannel === "playlists" && <HomePlaylistsView />}
        {activeChannel === "songs-artists" && <HomeSongsArtistsView />}
      </div>
    </div>
  );
};

export default memo(HomePage);
