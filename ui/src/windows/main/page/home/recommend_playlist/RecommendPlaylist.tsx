import Color from "color";
import { FC, memo, startTransition, useEffect, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import PlaylistList from "./list";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const RecommendPlaylist: FC<object> = () => {
  const [recommend, setRecommend] = useState<NeteaseAPI.RecommendPlaylistResult[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();

  const reload = useUpdate();
  useEffect(() => {
    setStatus("loading");
    NeteaseAPI.Playlist.recommend(120)
      .then((result) => {
        startTransition(() => {
          setRecommend(result.result);
          setStatus("loaded");
        });
      })
      .catch(() => {
        startTransition(() => setStatus("error"));
      });
  }, [reload.count]);
  return (
    <div className="w-full overflow-hidden contain-layout pb-18">
      <h1 className="font-bold text-lg" style={{ color: titleColor }}>
        推荐歌单
      </h1>
      <AppErrorBoundary
        name="RecommendPlaylist"
        className="w-full h-auto"
        showError
        canReset
        onReset={reload}>
        <ThrowIf when={status === "error"} message="推荐歌单加载失败" />
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <PlaylistList recommend={recommend} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};
export default memo(RecommendPlaylist);
