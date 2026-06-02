import { memo, useCallback, useMemo } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { ListMusic } from "lucide-react";
import AppLoading from "@/common/components/fallback/app-loading";
import PlaylistList from "@/common/components/playlist_list";
import AppError from "@/common/components/fallback/app-error";
import HomeSection from "@/wins/main/componets/home-section";

const RecommendPlaylist = ({ onClickItem }: { onClickItem?: NormalFunc<[id: number]> }) => {
  const { status, data, fetchData } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIPlaylist.recommend(12), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => (data?.result ?? []).length !== 0);
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
    <HomeSection title="推荐歌单" subTitle="Playlist Picks" Icon={ListMusic}>
      <AppError when={status === "error"} reset={reload} message="加载推荐歌单失败">
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <PlaylistList list={recommend} onClickItem={onClickItem} />
        </AppLoading>
      </AppError>
    </HomeSection>
  );
};

export default memo(RecommendPlaylist);
