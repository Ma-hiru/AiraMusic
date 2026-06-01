import { type FC, memo, useCallback, useMemo } from "react";
import { BannerType, PlaylistSource } from "@/common/enum";
import { NeteaseTrackRecord, NeteaseURL } from "@/common/netease/models";
import { useNavigate } from "react-router-dom";
import { NeteaseAPIHome } from "@/common/netease/api";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { RendererIPC } from "@/common/lib/ipc";
import AppEntry from "@/wins/main/entry";

import Carousel from "@/common/components/carousel";
import AppError from "@/common/components/fallback/app-error";

interface BannerProps {
  className?: string;
}

const Banner: FC<BannerProps> = ({ className }) => {
  const navigate = useNavigate();
  const player = AppEntry.usePlayer();
  const getBanner = useCallback(() => NeteaseAPIHome.banner().then((res) => res.banners), []);
  const { status, data: banners = [], fetchData } = useRequestStatusWrap(getBanner);
  const { reload } = useRequestAutoRetry(fetchData, [], () => banners.length !== 0);

  const bannerItems = useMemo(() => {
    return banners.map((b) => ({
      url: b.bigImageUrl,
      title: b.typeTitle
    }));
  }, [banners]);

  const resolveBanner = useCallback(
    async (i: number) => {
      const item = banners[i];
      if (!item) return;
      const { type, id } = NeteaseURL.parseBannerURL(item.url);

      switch (type) {
        case BannerType.song: {
          if (player.current.track?.id === id) return;
          const track = await NeteaseServicesTrack.idEnsure(id);
          const record = new NeteaseTrackRecord({
            detail: track,
            sourceID: -1,
            sourceName: "other"
          });
          player.playlist.add(record, "next");
          player.playlist.jump(record);
          return;
        }
        case BannerType.web: {
          RendererIPC.Event("openExternalLink", {
            url: item.url,
            title: item.typeTitle
          });
          return;
        }
        case BannerType.playlist: {
          navigate(RoutePathMain.playlist.withQuery(id, PlaylistSource.Normal));
          return;
        }
        case BannerType.album:
          return navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
      }
    },
    [banners, navigate, player]
  );

  return (
    <AppError asChild={false} className={className} reset={reload} when={status === "error"}>
      <Carousel items={bannerItems} onClick={resolveBanner} />
    </AppError>
  );
};

export default memo(Banner);
