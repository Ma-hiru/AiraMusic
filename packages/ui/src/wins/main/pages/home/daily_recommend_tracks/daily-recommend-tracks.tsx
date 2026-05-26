import { useAtom } from "jotai";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { NeteaseAPITrack } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";
import RecommendTrackTitle from "./recommend-track-title";
import RecommendTrackList from "./list";
import AppLoading from "@/common/components/fallback/app-loading";
import AppError from "@/common/components/fallback/app-error";

const DailyRecommendTracks: FC<object> = () => {
  const [backgroundCover, setBackgroundCover] = useAtom(backgroundCoverAtom);
  const {
    status,
    data: recommend = [],
    fetchData
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

  useEffect(() => {
    const cover = recommend[0]?.al.picUrl;
    if (backgroundCover || !cover) return;
    setBackgroundCover(cover);
  }, [backgroundCover, recommend, setBackgroundCover]);

  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <AppError reset={reload} when={status === "error"}>
        <AppLoading loading={status === "loading"} className="w-full h-auto">
          <RecommendTrackList recommend={recommend} containerRef={containerRef} />
        </AppLoading>
      </AppError>
    </div>
  );
};
export default memo(DailyRecommendTracks);
