import { FC, memo, useEffect, useState } from "react";
import { dailyRecommendTracks } from "@mahiru/ui/api/recommend";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<DailyRecommendTracksDailySong[]>([]);
  const [recommendReason, setRecommendReason] = useState<DailyRecommendTracksRecommendReason[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.5).string();
  useEffect(() => {
    dailyRecommendTracks().then((result) => {
      setRecommend(result.data.dailySongs);
      setRecommendReason(result.data.recommendReasons);
    });
  }, []);
  return (
    <div className="w-full">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        每日精选歌曲
      </h1>
    </div>
  );
};
export default memo(DailyRecommendTracks);
