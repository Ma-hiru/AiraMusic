import { Sparkles } from "lucide-react";
import { memo, useEffect, useCallback } from "react";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Section from "@/common/components/layout/section";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import AppLoading from "@/common/components/fallback/app-loading";

const DailyRecommendPlaylist = ({
  onClickItem,
  onDataLoaded
}: {
  onClickItem?: NormalFunc<[id: number]>;
  onDataLoaded?: NormalFunc<[recommend: NeteaseAPI.DailyRecommendPlaylistResult[]]>;
}) => {
  const {
    status,
    fetchData,
    data: recommend = []
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIPlaylist.recommendDaily().then((res) => res.recommend), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => recommend.length !== 0);

  useEffect(() => {
    recommend.length && onDataLoaded?.(recommend);
  }, [onDataLoaded, recommend]);

  return (
    <Section title="每日推荐歌单" Icon={Sparkles} subTitle="Daily Mix">
      <AppError reset={reload} message="加载每日推荐歌单失败" when={status === "error"}>
        <AppLoading className="h-fit w-full" loading={status === "loading"}>
          <MediaGrid
            onClickItem={onClickItem}
            items={recommend.map((r) => ({
              name: r.name,
              id: r.id,
              coverUrl: r.picUrl,
              playCount: r.playcount,
              badge: (r.trackCount ?? 0) + " 首"
            }))}
          />
        </AppLoading>
      </AppError>
    </Section>
  );
};

export default memo(DailyRecommendPlaylist);
