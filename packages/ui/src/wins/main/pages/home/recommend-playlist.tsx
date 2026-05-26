import { memo, useMemo } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import AppLoading from "@/common/components/fallback/app-loading";
import PlaylistList from "@/common/components/playlist_list";
import AppError from "@/common/components/fallback/app-error";

const RecommendPlaylist = ({ onClickItem }: { onClickItem?: NormalFunc<[id: number]> }) => {
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPIPlaylist.recommend);
  const { reload } = useRequestAutoRetry(fetchData, [120], () => (data?.result ?? []).length !== 0);
  const recommend = useMemo(() => {
    if (!data || !data.result) return [];
    const set = new Set<string>();
    return data.result.filter((item) => {
      if (set.has(String(item.id))) return false;
      set.add(String(item.id));
      return true;
    });
  }, [data]);

  return (
    <div className="w-full overflow-hidden contain-layout">
      <h1 className="font-bold text-lg text-(--text-color-on-main)">推荐歌单</h1>
      <AppError when={status === "error"} reset={reload}>
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <PlaylistList list={recommend} onClickItem={onClickItem} />
        </AppLoading>
      </AppError>
    </div>
  );
};

export default memo(RecommendPlaylist);
