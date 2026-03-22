import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import NCM_API from "@mahiru/ui/public/api";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendTracksDailySong[]>([]);
  const { theme, updateTheme } = useLayoutStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const lastPage = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: -containerRef.current.clientWidth,
        behavior: "smooth"
      });
    }
  }, []);
  const nextPage = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollBy({
        left: containerRef.current.clientWidth,
        behavior: "smooth"
      });
    }
  }, []);

  useEffect(() => {
    NCM_API.Track.recommendDaily().then((result) => {
      setRecommend(result.data.dailySongs);
    });
  }, []);

  useEffect(() => {
    if (!theme.backgroundCover) {
      updateTheme(theme.copy().setBackgroundCover(recommend[0]?.al.picUrl));
    }
  }, [recommend, theme, updateTheme]);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <RecommendTrackList recommend={recommend} containerRef={containerRef} />
    </div>
  );
};
export default memo(DailyRecommendTracks);
