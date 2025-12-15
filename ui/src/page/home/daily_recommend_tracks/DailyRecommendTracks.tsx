import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import { API } from "@mahiru/ui/api";

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
    API.Recommend.dailyRecommendTracks().then((result) => {
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
