import { useAtom } from "jotai";
import { type FC, memo, useCallback, useEffect, useRef } from "react";
import { NeteaseAPITrack } from "@mahiru/ui/common/source/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";
import { backgroundCoverAtom } from "@mahiru/ui/windows/main/atoms/theme";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import AppErrorBoundary, {
  type AppErrorBoundaryRef
} from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";

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

  const errRef = useRef<AppErrorBoundaryRef>({});
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
      <AppErrorBoundary
        ref={errRef}
        className="w-full h-auto"
        showError
        canReset
        name="DailyRecommendTracks"
        onReset={reload}
        toast={false}>
        <ThrowIf when={status === "error"} />
        <AppLoading loading={status === "loading"} className="w-full h-auto">
          <RecommendTrackList recommend={recommend} containerRef={containerRef} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(DailyRecommendTracks);
