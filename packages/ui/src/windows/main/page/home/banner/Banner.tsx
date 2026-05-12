import { FC, memo, useCallback, useMemo, useRef } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { BannerType, PlaylistSource } from "@mahiru/ui/public/enum";
import { Log } from "../../../../../public/constants/dev";
import { NeteaseTrackRecord, NeteaseURL } from "@mahiru/ui/public/source/netease/models";
import { useNavigate } from "react-router-dom";
import { NeteaseAPIHome } from "@mahiru/ui/public/source/netease/api";
import { NeteaseServicesTrack } from "@mahiru/ui/public/source/netease/services";
import { ElectronServicesIPC } from "@mahiru/ui/public/source/electron/services";
import { RoutePath, RoutePathMain } from "@mahiru/ui/public/routes";
import { useRequestAutoRetry, useRequestStatusWrap } from "@mahiru/ui/public/hooks/useRequestWrap";
import AppEntry from "@mahiru/ui/windows/main/entry";

import Carousel from "@mahiru/ui/public/components/public/Carousel";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";

const Banner: FC<object> = () => {
  const { textColorOnMain } = useThemeColor();
  const { status, data, fetchData } = useRequestStatusWrap(NeteaseAPIHome.banner);
  const { reload } = useRequestAutoRetry(fetchData, [], () => banner.length !== 0);
  const banner = useMemo(() => data?.banners ?? [], [data?.banners]);
  const errRef = useRef<AppErrorBoundaryRef>({});
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
          ElectronServicesIPC.Event.normal.openExternalLink({
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
      <AppErrorBoundary
        ref={errRef}
        name="Banner"
        className="h-56 w-full"
        showError
        canReset
        onReset={reload}
        toast={false}>
        <ThrowIf when={status === "error"} />
        <Carousel
          className="h-56"
          items={banner.map((b) => ({
            url: b.bigImageUrl,
            title: b.typeTitle
          }))}
          titleColor={textColorOnMain.string()}
          onClick={handleClick}
        />
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Banner);
