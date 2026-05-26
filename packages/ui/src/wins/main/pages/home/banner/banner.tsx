import { type FC, memo, useCallback } from "react";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { BannerType, PlaylistSource } from "@/common/enum";
import { Log } from "@/common/lib/log";
import { NeteaseTrackRecord, NeteaseURL } from "@/common/netease/models";
import { useNavigate } from "react-router-dom";
import { NeteaseAPIHome } from "@/common/netease/api";
import { NeteaseServicesTrack } from "@/common/netease/services";
import { RoutePath, RoutePathMain } from "@/common/routes";
import { useRequestAutoRetry, useRequestStatusWrap } from "@/common/hooks/use-request-wrap";
import { RendererIPC } from "@/common/lib/ipc";
import AppEntry from "@/wins/main/entry";

import Carousel from "@/common/components/public/carousel";
import AppError from "@/common/components/fallback/app-error";

const Banner: FC<object> = () => {
  const {
    status,
    data: banner = [],
    fetchData
  } = useRequestStatusWrap(
    useCallback(() => NeteaseAPIHome.banner().then((res) => res.banners), [])
  );
  const { textColorOnMain } = useThemeColor();
  const { reload } = useRequestAutoRetry(fetchData, [], () => banner.length !== 0);
  const player = AppEntry.usePlayer();
  const navigate = useNavigate();

  const handleClick = useCallback(
    async (i: number) => {
      const item = banner[i];
      if (!item) return;
      const { type, id } = NeteaseURL.parseBannerURL(item.url);
      Log.debug("Banner clicked", item, type, id);
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
    [banner, navigate, player]
  );

  return (
    <div className="w-full px-2">
      <AppError reset={reload} when={status === "error"}>
        <Carousel
          className="h-56"
          items={banner.map((b) => ({
            url: b.bigImageUrl,
            title: b.typeTitle
          }))}
          titleColor={textColorOnMain.string()}
          onClick={handleClick}
        />
      </AppError>
    </div>
  );
};
export default memo(Banner);
