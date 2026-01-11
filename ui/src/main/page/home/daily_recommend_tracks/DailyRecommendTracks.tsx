import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { API } from "@mahiru/ui/public/api";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<DailyRecommendTracksDailySong[]>([]);
  const { PlayerTheme, UpdatePlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
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
    if (!PlayerTheme.BackgroundCover) {
      UpdatePlayerTheme({
        BackgroundCover: recommend[0]?.al.picUrl
      });
    }
  }, [PlayerTheme.BackgroundCover, UpdatePlayerTheme, recommend]);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <RecommendTrackList recommend={recommend} containerRef={containerRef} />
    </div>
  );
};
export default memo(DailyRecommendTracks);
