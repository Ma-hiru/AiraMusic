import { FC, memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

import RecommendTrackTitle from "./RecommendTrackTitle";
import RecommendTrackList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";

const DailyRecommendTracks: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendTracksDailySong[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const { theme, updateTheme } = useLayoutStore();
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

  const update = useUpdate();

  const reload = useCallback(() => {
    setStatus("loading");
    setRecommend([]);
    update();
  }, [update]);

  useEffect(() => {
    if (recommend.length !== 0) return;
    let cancel = false;
    const unsubscribe = ElectronServices.Net.autoRetryRequest(
      () => {
        errRef.current.resetComponent?.();
        setStatus("loading");
        return NeteaseAPI.Track.recommendDaily();
      },
      (ok, result) => {
        if (cancel) return;
        if (ok) {
          startTransition(() => {
            setRecommend(result.data.dailySongs);
            setStatus("loaded");
          });
        } else {
          startTransition(() => setStatus("error"));
        }
      },
      () => recommend.length !== 0
    );
    return () => {
      cancel = true;
      unsubscribe();
    };
  }, [recommend.length, update.count]);

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
