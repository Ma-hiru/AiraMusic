import { FC, memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendTracksDailySong[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
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

  const reload = useUpdate();
  useEffect(() => {
    setStatus("loading");
    NeteaseAPI.Track.recommendDaily()
      .then((result) => {
        startTransition(() => {
          setRecommend(result.data.dailySongs);
          setStatus("loaded");
        });
      })
      .catch(() => {
        startTransition(() => setStatus("error"));
      });
  }, [reload.count]);

  useEffect(() => {
    const cover = recommend[0]?.al.picUrl;
    if (theme.backgroundCover || !cover) return;
    updateTheme(theme.copy().setBackgroundCover(cover));
  }, [recommend, theme, updateTheme]);

  return (
    <div className="w-full overflow-hidden contain-layout">
      <RecommendTrackTitle lastPage={lastPage} nextPage={nextPage} />
      <AppErrorBoundary
        className="w-full h-auto"
        showError
        canReset
        name="DailyRecommendTracks"
        onReset={reload}>
        <ThrowIf when={status === "error"} message="每日推荐歌曲加载失败" />
        <AppLoading loading={status === "loading"} className="w-full h-auto">
          <RecommendTrackList recommend={recommend} containerRef={containerRef} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(DailyRecommendTracks);
