import Color from "color";
import { FC, memo, useEffect, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import RecommendPlaylistList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

const DailyRecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendPlaylistResult[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();
  useEffect(() => {
    NeteaseAPI.Playlist.recommendDaily().then((result) => {
      setRecommend(result.recommend);
    });
  }, []);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        每日精选歌单
      </h1>
      <RecommendPlaylistList recommend={recommend} />
    </div>
  );
};
export default memo(DailyRecommendPlaylist);
