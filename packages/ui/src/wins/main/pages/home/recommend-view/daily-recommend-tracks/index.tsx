import { memo, useRef, type FC, useCallback } from "react";
import { NeteaseAPITrack } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";

import RecommendTrackList from "./list";
import RecommendTrackTitle from "./title";

const DailyRecommendTracks: FC<object> = () => {
  const {
    status,
    fetchData,
    data: recommend = []
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPITrack.recommendDaily().then((res) => res.data.dailySongs), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => recommend.length !== 0);

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

  return (
    <div className="w-full overflow-hidden contain-layout min-h-40">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <AppError reset={reload} when={status === "error"}>
        <AppLoading className="w-full h-auto" loading={status === "loading"}>
          <RecommendTrackList recommend={recommend} containerRef={containerRef} />
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(DailyRecommendTracks);
