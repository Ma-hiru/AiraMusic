import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import Title from "@mahiru/ui/componets/public/Title";
import {
  dailyRecommendPlaylist,
  highQualityPlaylist,
  playlistCatlist,
  recommendPlaylist,
  topPlaylist
} from "@mahiru/ui/api/playlist";
import { topSong } from "@mahiru/ui/api/track";

const HomePage: FC<object> = () => {
  usePlayingBackground();
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Title title="推荐" />
      <div className="flex flex-col gap-2">
        <button
          onClick={() => {
            recommendPlaylist({ limit: 10 }).then(console.log);
          }}>
          get personalized
        </button>
        <button
          onClick={() => {
            highQualityPlaylist({
              cat: "全部",
              limit: 10,
              before: Date.now()
            }).then(console.log);
          }}>
          get highquality
        </button>
        <button
          onClick={() => {
            dailyRecommendPlaylist({ limit: 10 }).then(console.log);
          }}>
          get dailyRecommend
        </button>
        <button
          onClick={() => {
            topPlaylist({
              limit: 10,
              order: "hot",
              cat: "全部"
            }).then(console.log);
          }}>
          get topList
        </button>
        <button
          onClick={() => {
            playlistCatlist().then(console.log);
          }}>
          get playlistCatlist
        </button>
        <button
          onClick={() => {
            topSong(0).then(console.log);
          }}>
          get topSong
        </button>
      </div>
    </div>
  );
};

export default memo(HomePage);
