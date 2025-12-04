import { FC, memo, useEffect, useState } from "react";
import { dailyRecommendPlaylist } from "@mahiru/ui/api/recommend";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";

const DailyRecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<DailyRecommendPlaylistResult[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.5).string();
  // useEffect(() => {
  //   dailyRecommendPlaylist({
  //     limit: 30
  //   }).then((result) => {
  //     setRecommend(result.recommend);
  //   });
  // }, []);
  return (
    <div className="w-full">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        每日精选歌单
      </h1>
    </div>
  );
};
export default memo(DailyRecommendPlaylist);
