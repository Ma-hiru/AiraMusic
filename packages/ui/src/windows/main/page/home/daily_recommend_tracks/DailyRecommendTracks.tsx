import { FC, memo, useCallback, useEffect, useMemo, useRef } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { NeteaseAPITrack } from "@mahiru/ui/common/source/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/common/hooks/useRequestWrap";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/common/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/common/components/fallback/AppLoading";

const DailyRecommendTracks: FC<object> = () => {
  const { theme, updateTheme } = useLayoutStore();
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPITrack.recommendDaily);
  const { reload } = useRequestAutoRetry(
    fetchData,
    [],
    () => (data?.data.dailySongs ?? []).length !== 0
  );
  const recommend = useMemo(() => data?.data.dailySongs ?? [], [data?.data.dailySongs]);
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
    if (theme.backgroundCover || !cover) return;
    updateTheme(theme.copy().setBackgroundCover(cover));
  }, [recommend, theme, updateTheme]);

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
