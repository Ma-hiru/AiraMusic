import { DiscAlbum } from "lucide-react";
import { memo, type FC, useMemo, useCallback } from "react";
import { NeteaseAPIAlbum } from "@/common/netease/api";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import Section from "@/common/components/layout/section";
import AppError from "@/common/components/fallback/app-error";
import MediaGrid from "@/common/components/layout/media-grid";
import RendererImageConstants from "@/common/constants/image";
import AppLoading from "@/common/components/fallback/app-loading";

interface NewAlbumsProps {
  onClickItem?: NormalFunc<[id: number]>;
}

const getAlbumArtists = (album: NeteaseAPI.ArtistAlbum) => {
  return album.artists?.map((artist) => artist.name).join(" / ") || album.artist?.name || "";
};

const NewAlbums: FC<NewAlbumsProps> = ({ onClickItem }) => {
  const {
    status,
    fetchData,
    data: albums = []
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
        badge: album.subType
      })),
    [albums]
  );

  return (
    <Section title="新碟上架" Icon={DiscAlbum} subTitle="New Albums">
      <AppError reset={reload} message="加载新碟失败" when={status === "error"}>
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

export default memo(NewAlbums);
