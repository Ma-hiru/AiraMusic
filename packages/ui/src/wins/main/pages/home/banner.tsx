import { useNavigate } from "react-router-dom";
import { memo, type FC, useMemo, useCallback } from "react";
import { BannerType } from "@/common/enum";
import { RendererIPC } from "@mahiru/ipc/renderer";
import { NeteaseAPIHome } from "@/common/netease/api";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { NeteaseURL, NeteaseTrackRecord } from "@/common/netease/models";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import Carousel from "@/common/components/display/carousel";
import AppError from "@/common/components/fallback/app-error";

interface BannerProps {
  className?: string;
}

const Banner: FC<BannerProps> = ({ className }) => {
  const navigate = useNavigate();
  const player = RendererPlayerHandle.usePlayer();
  const getBanner = useCallback(() => NeteaseAPIHome.banner().then((res) => res.banners), []);
  const { status, fetchData, data: banners = [] } = useRequestStatusWrap(getBanner);
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
      const { id, type } = NeteaseURL.parseBannerURL(item.url);

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
          RendererIPC.NormalChannel.send("event_window_external", {
            url: item.url,
            title: item.typeTitle
          });
          return;
        }
        case BannerType.playlist: {
          navigate(RoutePathMain.playlist.withQuery(id, "normal"));
          return;
        }
        case BannerType.album:
          return navigate(RoutePath.withQuery(RoutePathMain.album, { id }));
      }
    },
    [banners, navigate, player]
  );

  return (
    <AppError className={className} reset={reload} asChild={false} when={status === "error"}>
      <Carousel className={className} items={bannerItems} onClick={resolveBanner} />
    </AppError>
  );
};

export default memo(Banner);
