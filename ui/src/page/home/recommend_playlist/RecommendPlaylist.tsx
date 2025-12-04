import { FC, memo, useEffect, useState } from "react";
import { recommendPlaylist } from "@mahiru/ui/api/recommend";
import Color from "color";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const RecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<RecommendPlaylistResult[]>([]);
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.5).string();
  useEffect(() => {
    recommendPlaylist({
      limit: 30
    }).then((result) => {
      setRecommend(result.result);
    });
  }, []);
  return (
    <div className="w-full">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        推荐歌单
      </h1>
    </div>
  );
};
export default memo(RecommendPlaylist);
