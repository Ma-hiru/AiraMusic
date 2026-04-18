import Color from "color";
import { FC, memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";

import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import RecommendPlaylistList from "./list";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const DailyRecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendPlaylistResult[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const { mainColor } = useThemeColor();
  const errRef = useRef<AppErrorBoundaryRef>({});
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();

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
        return NeteaseAPI.Playlist.recommendDaily();
      },
      (ok, result) => {
        if (cancel) return;
        if (ok) {
          startTransition(() => {
            setRecommend(result.recommend);
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
  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        每日推荐歌单
      </h1>
      <AppErrorBoundary
        ref={errRef}
        name="DailyRecommendPlaylist"
        className="w-full h-auto"
        showError
        canReset
        toast={false}
        onReset={reload}>
        <ThrowIf when={status === "error"} />
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <RecommendPlaylistList recommend={recommend} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(DailyRecommendPlaylist);
