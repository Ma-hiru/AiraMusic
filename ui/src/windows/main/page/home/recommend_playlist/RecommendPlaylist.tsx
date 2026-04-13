import Color from "color";
import { FC, memo, useEffect, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import PlaylistList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

const RecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.RecommendPlaylistResult[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();
  useEffect(() => {
    NeteaseAPI.Playlist.recommend(60).then((result) => {
      setRecommend(result.result);
    });
  }, []);
  return (
    <div className="w-full overflow-hidden contain-layout pb-18">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        推荐歌单
      </h1>
      <PlaylistList recommend={recommend} />
    </div>
  );
};
export default memo(RecommendPlaylist);
