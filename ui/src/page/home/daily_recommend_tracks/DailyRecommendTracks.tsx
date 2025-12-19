import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import { API } from "@mahiru/ui/api";
import { usePlayerStatus } from "@mahiru/ui/store";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<DailyRecommendTracksDailySong[]>([]);
  const { background, setBackground } = usePlayerStatus(["background", "setBackground"]);
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
    API.Recommend.dailyRecommendTracks().then((result) => {
      setRecommend(result.data.dailySongs);
    });
  }, []);

  useEffect(() => {
    if (!background) {
      setBackground(recommend[0]?.al.picUrl);
    }
  }, [background, recommend, setBackground]);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <RecommendTrackList recommend={recommend} containerRef={containerRef} />
    </div>
  );
};
export default memo(DailyRecommendTracks);
