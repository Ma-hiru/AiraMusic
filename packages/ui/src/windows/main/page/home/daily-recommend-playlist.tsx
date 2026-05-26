import { memo, useCallback } from "react";
import { NeteaseAPIPlaylist } from "@mahiru/ui/common/source/netease/api";
import {
  useRequestAutoRetry,
  useRequestStatusWrap
} from "@mahiru/ui/common/hooks/use-request-wrap";

import AppErrorBoundary from "../../../../common/components/fallback/app-error-boundary";
import ThrowIf from "../../../../common/components/fallback/throw-if";
import AppLoading from "../../../../common/components/fallback/app-loading";
import PlaylistList from "@mahiru/ui/common/components/playlist_list";

const DailyRecommendPlaylist = ({ onClickItem }: { onClickItem?: NormalFunc<[id: number]> }) => {
  const {
    status,
    data: recommend = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIPlaylist.recommendDaily().then((res) => res.recommend), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => recommend.length !== 0);

  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg text-(--text-color-on-main)">每日推荐歌单</h1>
      <AppErrorBoundary
        name="DailyRecommendPlaylist"
        className="w-full h-auto"
        showError
        canReset
        toast={false}
        onReset={reload}>
        <ThrowIf when={status === "error"} />
        <AppLoading loading={status === "loading"} className="h-fit w-full">
          <PlaylistList list={recommend} onClickItem={onClickItem} />
        </AppLoading>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(DailyRecommendPlaylist);
