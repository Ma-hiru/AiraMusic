import Color from "color";
import PlaylistList from "./list";
import { FC, memo, useEffect, useState } from "react";
import { recommendPlaylist } from "@mahiru/ui/api/recommend";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const RecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<RecommendPlaylistResult[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();
  useEffect(() => {
    recommendPlaylist(60).then((result) => {
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
