import { type FC, memo, useCallback, useMemo } from "react";
import { Trophy } from "lucide-react";
import { NeteaseAPIHome } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { RendererHomeConstants } from "@/wins/main/constants";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "./home-media-grid";
import HomeSection from "./home-section";

interface ToplistsProps {
  onClickItem?: NormalFunc<[id: number]>;
}

const Toplists: FC<ToplistsProps> = ({ onClickItem }) => {
  const {
    status,
    data: toplists = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIHome.toplists().then((res) => res.list), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => toplists.length !== 0);
  const items = useMemo(() => {
    const selected = RendererHomeConstants.HOME_FEATURED_TOPLIST_IDS.map((id) =>
      toplists.find((item) => item.id === id)
    ).filter(Boolean) as NeteaseAPI.NeteaseToplist[];
    const list = selected.length ? selected : toplists.slice(0, 5);
    return list.map((item) => ({
      id: item.id,
      name: item.name,
      coverUrl: item.coverImgUrl,
      meta: item.updateFrequency,
      playCount: item.playCount
    }));
  }, [toplists]);

  return (
    <HomeSection title="排行榜" subTitle="Charts" Icon={Trophy}>
      <AppError reset={reload} when={status === "error"} message="加载排行榜失败">
        <AppLoading loading={status === "loading"} className="h-40">
          <HomeMediaGrid items={items} onClickItem={onClickItem} />
        </AppLoading>
      </AppError>
    </HomeSection>
  );
};

export default memo(Toplists);
