import { FC, memo, UIEvent as ReactUIEvent, useCallback, useEffect, useRef } from "react";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useDelay } from "@mahiru/ui/public/hooks/useDelay";

import Banner from "./banner";
import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./daily_recommend_playlist";
import RecommendPlaylist from "./recommend_playlist";

const Content: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const { UpdateScrollTop } = useLayoutStore(["UpdateScrollTop"]);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const wrapOnScroll = useCallback(
    (e: ReactUIEvent) => {
      const scrollDistance = e.currentTarget.scrollTop;
      if (scrollDistance > 500) {
        UpdateScrollTop({ type: "home", callback: scrollTop });
      } else {
        UpdateScrollTop({ type: "none", callback: null });
      }
      return onScroll();
    },
    [UpdateScrollTop, onScroll, scrollTop]
  );

  useEffect(() => {
    return () => {
      UpdateScrollTop({
        type: "none",
        callback: null
      });
    };
  }, [UpdateScrollTop]);

  const reachedSet = useDelay([200, 1000, 5000, 10000]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto scrollbar will-change-scroll contain-strict"
      onScroll={wrapOnScroll}>
      {reachedSet.has(200) && <Banner />}
      {reachedSet.has(1000) && <DailyRecommendTracks />}
      {reachedSet.has(5000) && <DailyRecommendPlaylist />}
      {reachedSet.has(10000) && <RecommendPlaylist />}
    </div>
  );
};
export default memo(Content);
