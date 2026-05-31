import { type FC, memo, useCallback, useMemo } from "react";
import { DiscAlbum } from "lucide-react";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import RendererImageConstants from "@/common/constants/image";

import AppError from "@/common/components/fallback/app-error";
import AppLoading from "@/common/components/fallback/app-loading";
import HomeMediaGrid from "./home-media-grid";
import HomeSection from "./home-section";

interface NewAlbumsProps {
  onClickItem?: NormalFunc<[id: number]>;
}

const getAlbumArtists = (album: NeteaseAPI.ArtistAlbum) => {
  return album.artists?.map((artist) => artist.name).join(" / ") || album.artist?.name || "";
};

const NewAlbums: FC<NewAlbumsProps> = ({ onClickItem }) => {
  const {
    status,
    data: albums = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(
      () => NeteaseAPIAlbum.allNews({ area: "ALL", limit: 10 }).then((response) => response.albums),
      []
    )
  );
  const { reload } = useRequestAutoRetry(fetchData, [], () => albums.length !== 0);
  const items = useMemo(
    () =>
      albums.map((album) => ({
        id: album.id,
        name: album.name,
        coverUrl: album.picUrl,
        meta: getAlbumArtists(album),
        badge: String(new Date(album.publishTime).getFullYear())
      })),
    [albums]
  );

  return (
    <HomeSection title="新碟上架" subTitle="New Albums" Icon={DiscAlbum}>
      <AppError reset={reload} when={status === "error"} message="加载新碟失败">
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

export default memo(NewAlbums);
