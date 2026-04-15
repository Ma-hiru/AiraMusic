import Color from "color";
import { FC, memo, startTransition, useEffect, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import RecommendPlaylistList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const DailyRecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.DailyRecommendPlaylistResult[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();

  const reload = useUpdate();
  useEffect(() => {
    setStatus("loading");
    NeteaseAPI.Playlist.recommendDaily()
      .then((result) => {
        startTransition(() => {
          setRecommend(result.recommend);
          setStatus("loaded");
        });
      })
      .catch(() => {
        startTransition(() => setStatus("error"));
      });
  }, [reload.count]);
  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        每日精选歌单
      </h1>
      <AppErrorBoundary
        name="DailyRecommendPlaylist"
        className="w-full h-auto"
        showError
        canReset
        onReset={reload}>
        <ThrowIf when={status === "error"} message="每日推荐歌单加载失败" />
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <RecommendPlaylistList recommend={recommend} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(DailyRecommendPlaylist);
