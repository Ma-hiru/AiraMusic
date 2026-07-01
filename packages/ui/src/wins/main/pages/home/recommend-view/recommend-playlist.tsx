import { ListMusic } from "lucide-react";
import { memo, useMemo, useEffect, useCallback } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Section from "@/common/components/layout/section";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";

const RecommendPlaylist = ({
  onClickItem,
  onDataLoaded
}: {
  onClickItem?: NormalFunc<[id: number]>;
  onDataLoaded?: NormalFunc<[data: NeteaseAPI.RecommendPlaylistResult[]]>;
}) => {
  const { data, status, fetchData } = useRequestStatusWrap(
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
    <Section title="推荐歌单" Icon={ListMusic} subTitle="Playlist Picks">
      <AppError reset={reload} message="加载推荐歌单失败" when={status === "error"}>
        <AppLoading className="h-auto w-full" loading={status === "loading"}>
          <MediaGrid
            onClickItem={onClickItem}
            items={recommend.map((r) => ({
              name: r.name,
              id: r.id,
              coverUrl: r.picUrl,
              playCount: r.playCount,
              badge: (r.trackCount ?? 0) + " 首"
            }))}
          />
        </AppLoading>
      </AppError>
    </Section>
  );
};

export default memo(RecommendPlaylist);
