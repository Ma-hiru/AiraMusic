import { UserRound } from "lucide-react";
import { memo, type FC, useMemo, useCallback } from "react";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Section from "@/common/components/layout/section";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";

interface RecommendArtistsProps {
  onClickItem?: NormalFunc<[id: number]>;
}

const RecommendArtists: FC<RecommendArtistsProps> = ({ onClickItem }) => {
  const {
    status,
    fetchData,
    data: artists = []
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
    <Section title="推荐歌手" Icon={UserRound} subTitle="Artist Chart">
      <AppError reset={reload} message="加载歌手榜失败" when={status === "error"}>
        <AppLoading className="h-40" loading={status === "loading"}>
          <MediaGrid
            items={items}
            coverSize={RendererImageConstants.AlbumListCoverSize}
            onClickItem={onClickItem}
          />
        </AppLoading>
      </AppError>
    </Section>
  );
};

export default memo(RecommendArtists);
