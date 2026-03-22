import { FC, memo, UIEvent as ReactUIEvent, useCallback, useRef } from "react";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useDelay } from "@mahiru/ui/public/hooks/useDelay";

import Banner from "./banner";
import DailyRecommendTracks from "./daily_recommend_tracks";
import DailyRecommendPlaylist from "./daily_recommend_playlist";
import RecommendPlaylist from "./recommend_playlist";

const Content: FC<object> = () => {
  const { layout, updateLayout } = useLayoutStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const delay = useDelay([200, 1000, 5000, 10000]);
  useScrollAutoHide(containerRef);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const onScroll = useCallback(
    (e: ReactUIEvent) => {
      const scrollDistance = e.currentTarget.scrollTop;
      if (layout.scrollTop() !== scrollTop && scrollDistance > 500) {
        updateLayout(layout.copy().setScrollTop(scrollTop));
      } else if (layout.scrollTop() !== undefined && scrollDistance <= 500) {
        updateLayout(layout.copy().setScrollTop(undefined));
      }
    },
    [layout, scrollTop, updateLayout]
  );

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto scrollbar will-change-scroll contain-strict"
      onScroll={onScroll}>
      {delay(200) && <Banner />}
      {delay(1000) && <DailyRecommendTracks />}
      {delay(5000) && <DailyRecommendPlaylist />}
      {delay(10000) && <RecommendPlaylist />}
    </div>
  );
};
export default memo(Content);
