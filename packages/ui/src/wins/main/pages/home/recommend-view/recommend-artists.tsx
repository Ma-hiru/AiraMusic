import { type FC, memo, useCallback, useMemo } from "react";
import { UserRound } from "lucide-react";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import RendererImageConstants from "@/common/constants/image";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "@/wins/main/componets/home-media-grid";
import HomeSection from "@/wins/main/componets/home-section";

interface RecommendArtistsProps {
  onClickItem?: NormalFunc<[id: number]>;
}

const RecommendArtists: FC<RecommendArtistsProps> = ({ onClickItem }) => {
  const {
    status,
    data: artists = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIArtist.toplist().then((response) => response.list.artists), [])
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => artists.length !== 0);
  const items = useMemo(
    () =>
      artists.slice(0, 10).map((artist, index) => ({
        id: artist.id,
        name: artist.name,
        coverUrl: artist.img1v1Url || artist.picUrl,
        meta: artist.trans || `${artist.musicSize} 首单曲`,
        badge: `No.${index + 1}`,
        shape: "circle" as const
      })),
    [artists]
  );

  return (
    <HomeSection title="推荐歌手" subTitle="Artist Chart" Icon={UserRound}>
      <AppError reset={reload} when={status === "error"} message="加载歌手榜失败">
        <AppLoading loading={status === "loading"} className="h-40">
          <HomeMediaGrid
            items={items}
            coverSize={RendererImageConstants.AlbumListCoverSize}
            onClickItem={onClickItem}
          />
        </AppLoading>
      </AppError>
    </HomeSection>
  );
};

export default memo(RecommendArtists);
