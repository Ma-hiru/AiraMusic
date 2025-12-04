import { FC, memo } from "react";
import Title from "@mahiru/ui/componets/public/Title";
import DailyRecommendTracks from "./daily_recommend_tracks/DailyRecommendTracks";
import DailyRecommendPlaylist from "./daily_recommend_playlist/DailyRecommendPlaylist";
import RecommendPlaylist from "./recommend_playlist/RecommendPlaylist";
import Banner from "@mahiru/ui/page/home/banner/Banner";

const HomePage: FC<object> = () => {
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Title title="推荐" />
      <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <Banner />
        <DailyRecommendTracks />
        <DailyRecommendPlaylist />
        <RecommendPlaylist />
      </div>
    </div>
  );
};

export default memo(HomePage);
