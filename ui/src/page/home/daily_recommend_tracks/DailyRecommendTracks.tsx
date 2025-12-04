import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { dailyRecommendTracks } from "@mahiru/ui/api/recommend";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<DailyRecommendTracksDailySong[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  usePlayingBackground(recommend[0]?.al.picUrl);

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
    dailyRecommendTracks().then((result) => {
      setRecommend(result.data.dailySongs);
    });
  }, []);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <RecommendTrackList recommend={recommend} containerRef={containerRef} />
    </div>
  );
};
export default memo(DailyRecommendTracks);
