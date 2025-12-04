import { FC, memo, useRef } from "react";
import Banner from "@mahiru/ui/page/home/banner/Banner";
import DailyRecommendTracks from "@mahiru/ui/page/home/daily_recommend_tracks/DailyRecommendTracks";
import DailyRecommendPlaylist from "@mahiru/ui/page/home/daily_recommend_playlist/DailyRecommendPlaylist";
import RecommendPlaylist from "@mahiru/ui/page/home/recommend_playlist/RecommendPlaylist";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";

const Content: FC<object> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll, onScrollEnd } = useScrollAutoHide(containerRef);
  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-y-auto scrollbar"
      onScroll={onScroll}
      onScrollEnd={onScrollEnd}>
      <Banner />
      <DailyRecommendTracks />
      <DailyRecommendPlaylist />
      <RecommendPlaylist />
    </div>
  );
};
export default memo(Content);
