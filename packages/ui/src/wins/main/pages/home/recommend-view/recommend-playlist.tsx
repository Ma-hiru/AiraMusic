import { memo, useCallback, useEffect, useMemo } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { ListMusic } from "lucide-react";
import AppLoading from "@/common/components/fallback/app-loading";
import AppError from "@/common/components/fallback/app-error";
import HomeSection from "@/wins/main/componets/home-section";
import HomeMediaGrid from "@/wins/main/componets/home-media-grid";

const RecommendPlaylist = ({
  onClickItem,
  onDataLoaded
}: {
  onClickItem?: NormalFunc<[id: number]>;
  onDataLoaded?: NormalFunc<[data: NeteaseAPI.RecommendPlaylistResult[]]>;
}) => {
  const { status, data, fetchData } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIPlaylist.recommend(30), [])
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

  useEffect(() => {
    recommend.length && onDataLoaded?.(recommend);
  }, [onDataLoaded, recommend]);

  return (
    <HomeSection title="推荐歌单" subTitle="Playlist Picks" Icon={ListMusic}>
      <AppError when={status === "error"} reset={reload} message="加载推荐歌单失败">
        <AppLoading loading={status === "loading"} className="h-auto w-full">
          <HomeMediaGrid
            items={recommend.map((r) => ({
              name: r.name,
              id: r.id,
              coverUrl: r.picUrl,
              playCount: r.playCount,
              badge: (r.trackCount ?? 0) + " 首"
            }))}
            onClickItem={onClickItem}
          />
        </AppLoading>
      </AppError>
    </HomeSection>
  );
};

export default memo(RecommendPlaylist);
