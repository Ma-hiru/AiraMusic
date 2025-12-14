import { FC, memo, UIEvent as ReactUIEvent, useCallback, useEffect, useRef } from "react";
import Banner from "@mahiru/ui/page/home/banner/Banner";
import DailyRecommendTracks from "@mahiru/ui/page/home/daily_recommend_tracks/DailyRecommendTracks";
import DailyRecommendPlaylist from "@mahiru/ui/page/home/daily_recommend_playlist/DailyRecommendPlaylist";
import RecommendPlaylist from "@mahiru/ui/page/home/recommend_playlist/RecommendPlaylist";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import { useLayoutStatus } from "@mahiru/ui/store";

const Content: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);
  const { requestCanScrollTop } = useLayoutStatus(["requestCanScrollTop"]);

  const scrollTop = useCallback(() => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const wrapOnScroll = useCallback(
    (e: ReactUIEvent) => {
      const scrollDistance = e.currentTarget.scrollTop;
      if (scrollDistance > 500) {
        requestCanScrollTop("home", scrollTop);
      } else {
        requestCanScrollTop("none");
      }
      return onScroll();
    },
    [onScroll, requestCanScrollTop, scrollTop]
  );

  useEffect(() => {
    return () => {
      requestCanScrollTop("none");
    };
  }, [requestCanScrollTop]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto scrollbar"
      onScroll={wrapOnScroll}>
      <Banner />
      <DailyRecommendTracks />
      <DailyRecommendPlaylist />
      <RecommendPlaylist />
    </div>
  );
};
export default memo(Content);
