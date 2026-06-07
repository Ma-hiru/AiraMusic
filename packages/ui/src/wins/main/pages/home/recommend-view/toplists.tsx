import { type FC, memo, useCallback, useMemo } from "react";
import { Trophy } from "lucide-react";
import { NeteaseAPIHome } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { RendererHomeConstants } from "@/wins/main/constants";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import MediaGrid from "@/common/components/layout/media-grid";
import Section from "@/common/components/layout/section";

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
  const gridItems = useMemo(() => {
    const selected = [];
    for (const t of toplists) {
      if (t && RendererHomeConstants.HOME_FEATURED_TOPLIST_IDS.has(t.id)) {
        selected.push(t);
      }
    }
    if (selected.length === 0) selected.push(...toplists.splice(0, 5));

    return selected.map((item) => ({
      id: item.id,
      name: item.name,
      coverUrl: item.coverImgUrl,
      meta: item.updateFrequency,
      playCount: item.playCount
    }));
  }, [toplists]);
  return (
    <Section title="排行榜" subTitle="Charts" Icon={Trophy}>
      <AppError reset={reload} when={status === "error"} message="加载排行榜失败">
        <AppLoading loading={status === "loading"} className="h-40">
          <MediaGrid items={gridItems} onClickItem={onClickItem} />
        </AppLoading>
      </AppError>
    </Section>
  );
};

export default memo(Toplists);
