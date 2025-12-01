import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import Title from "@mahiru/ui/componets/public/Title";
import { dailyRecommendTracks } from "@mahiru/ui/api/playlist";

const HomePage: FC<object> = () => {
  usePlayingBackground();
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Title title="推荐" />
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            dailyRecommendTracks().then(console.log);
          }}>
          get dailyRecommendTracks
        </button>
      </div>
    </div>
  );
};

export default memo(HomePage);
