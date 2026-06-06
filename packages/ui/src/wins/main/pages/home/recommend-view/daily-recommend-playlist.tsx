import { memo, useCallback, useEffect } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { Sparkles } from "lucide-react";
import AppLoading from "@/common/components/fallback/app-loading";
import AppError from "@/common/components/fallback/app-error";
import HomeSection from "@/wins/main/componets/home-section";
import HomeMediaGrid from "@/wins/main/componets/home-media-grid";

const DailyRecommendPlaylist = ({
  onClickItem,
  onDataLoaded
}: {
  onClickItem?: NormalFunc<[id: number]>;
  onDataLoaded?: NormalFunc<[recommend: NeteaseAPI.DailyRecommendPlaylistResult[]]>;
}) => {
  const {
    status,
    data: recommend = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIPlaylist.recommendDaily().then((res) => res.recommend), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => recommend.length !== 0);

  useEffect(() => {
    recommend.length && onDataLoaded?.(recommend);
  }, [onDataLoaded, recommend]);

  return (
    <HomeSection title="每日推荐歌单" subTitle="Daily Mix" Icon={Sparkles}>
      <AppError reset={reload} when={status === "error"} message="加载每日推荐歌单失败">
        <AppLoading loading={status === "loading"} className="h-fit w-full">
          <HomeMediaGrid
            items={recommend.map((r) => ({
              name: r.name,
              id: r.id,
              coverUrl: r.picUrl,
              playCount: r.playcount,
              badge: (r.trackCount ?? 0) + " 首"
            }))}
            onClickItem={onClickItem}
          />
        </AppLoading>
      </AppError>
    </HomeSection>
  );
};

export default memo(DailyRecommendPlaylist);
