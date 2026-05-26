import { memo, useCallback } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppLoading from "@/common/components/fallback/app-loading";
import PlaylistList from "@/common/components/playlist_list";
import AppError from "@/common/components/fallback/app-error";

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
      <AppError reset={reload} when={status === "error"}>
        <AppLoading loading={status === "loading"} className="h-fit w-full">
          <PlaylistList list={recommend} onClickItem={onClickItem} />
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(DailyRecommendPlaylist);
