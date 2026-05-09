import { FC, memo, useRef } from "react";
import { NeteaseAPIPlaylist } from "@mahiru/ui/public/source/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";

import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import RecommendPlaylistList from "./list";
import AppLoading from "@mahiru/ui/public/components/fallback/AppLoading";

const DailyRecommendPlaylist: FC<object> = () => {
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPIPlaylist.recommendDaily);
  const { reload } = useRequestAutoRetry(fetchData, [], () => (data?.recommend ?? []).length !== 0);
  const recommend = data?.recommend ?? [];
  const errRef = useRef<AppErrorBoundaryRef>({});

  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg text-(--text-color-on-main)">每日推荐歌单</h1>
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
