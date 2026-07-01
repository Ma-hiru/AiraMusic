import { cx } from "@emotion/css";
import { useLocation, useNavigate } from "react-router-dom";
import { memo, useRef, type FC, useState, useEffect, useCallback } from "react";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { scrollActionsAtom } from "@/wins/main/atoms/layout";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { useScrollActionsRegister } from "@/common/hooks/use-scroll-actions-register";
import type { HomeChannelKey } from "@/wins/main/constants";

import Banner from "./banner";
import ForYouPanel from "./for-you-panel";
import HomeChartsView from "./charts-view";
import HomeChannelTabs from "./channel-tabs";
import HomePlaylistsView from "./playlists-view";
import HomeRecommendView from "./recommend-view";
import HomeSongsArtistsView from "./songs-artists-view";

const HomePage: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [mounted, setMounted] = useState(0);
  const { activeChannel = "recommend" } = RoutePath.parseQuery<{ activeChannel: HomeChannelKey }>(
    location,
    RoutePathMain.home
  );
  useScrollAutoHide(containerRef);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const { canScrollTop } = useScrollActionsRegister({
    atom: scrollActionsAtom,
    active: useRouterActive(RoutePathMain, "home"),
    getScrollTopFunc: () => scrollTop
  });

  const changeChannel = useCallback(
    (activeChannel: HomeChannelKey) => {
      navigate(RoutePath.withQuery(RoutePathMain.home, { activeChannel }));
    },
    [navigate]
  );

  useEffect(() => {
    const activeChannelToIdx = (channel: HomeChannelKey) => {
      switch (channel) {
        case "recommend":
          return 0;
        case "charts":
          return 1;
        case "playlists":
          return 2;
        case "songs-artists":
          return 3;
      }
    };
    setMounted((bit) => bit | (1 << activeChannelToIdx(activeChannel)));
  }, [activeChannel]);

  return (
    <div className="router-container pt-0! px-2!">
      <div
        ref={containerRef}
        className={`
          w-full h-full
          overflow-y-scroll overflow-x-hidden
          flex flex-col gap-3
          scrollbar scrollbar-show
          px-5 will-change-scroll contain-strict
          relative
        `}
        onScroll={(e) => canScrollTop(e.currentTarget.scrollTop > 500)}>
        <HomeChannelTabs
          active={activeChannel}
          sticky={activeChannel !== "playlists"}
          onChange={changeChannel}
        />
        {!!(mounted & 0b1) && (
          <section
            className={cx(
              "grid grid-cols-1 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,24rem)]",
              activeChannel !== "recommend" && "hidden"
            )}>
            <Banner className="min-w-0 contain-layout" />
            <ForYouPanel className="min-w-0 hidden lg:block contain-layout" />
          </section>
        )}
        {!!(mounted & 0b1) && (
          <HomeRecommendView className={cx(activeChannel !== "recommend" && "hidden")} />
        )}
        {!!(mounted & 0b10) && (
          <HomeChartsView className={cx(activeChannel !== "charts" && "hidden")} />
        )}
        {!!(mounted & 0b100) && (
          <HomePlaylistsView className={cx(activeChannel !== "playlists" && "hidden")} />
        )}
        {!!(mounted & 0b1000) && (
          <HomeSongsArtistsView className={cx(activeChannel !== "songs-artists" && "hidden")} />
        )}
      </div>
    </div>
  );
};

export default memo(HomePage);
