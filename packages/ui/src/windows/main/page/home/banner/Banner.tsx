import { FC, memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { BannerType, PlaylistSource } from "@mahiru/ui/public/enum";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import { Log } from "@mahiru/ui/public/utils/dev";
import { NeteaseTrackRecord, NeteaseURL } from "@mahiru/ui/public/source/netease/models";
import { useNavigate } from "react-router-dom";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import AppEntry from "@mahiru/ui/windows/main/entry";

import Carousel from "@mahiru/ui/public/components/public/Carousel";
import AppErrorBoundary, {
  AppErrorBoundaryRef
} from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import ThrowIf from "@mahiru/ui/public/components/fallback/ThrowIf";
import { RoutePathMain } from "@mahiru/ui/public/routes";

const Banner: FC<object> = () => {
  const [banner, setBanner] = useState<NeteaseAPI.NeteaseBanner[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "loaded">("loading");
  const errRef = useRef<AppErrorBoundaryRef>({});
  const player = AppEntry.usePlayer();
  const navigate = useNavigate();

  const update = useUpdate();

  const reload = useCallback(() => {
    setStatus("loading");
    setBanner([]);
    update();
  }, [update]);

  useEffect(() => {
    if (banner.length !== 0) return;
    let cancel = false;
    const unsubscribe = ElectronServices.Net.autoRetryRequest(
      () => {
        errRef.current.resetComponent?.();
        setStatus("loading");
        return NeteaseAPI.Home.banner();
      },
      (ok, result) => {
        if (cancel) return;
        if (ok) {
          startTransition(() => {
            setBanner(result.banners);
            setStatus("loaded");
          });
        } else {
          startTransition(() => setStatus("error"));
        }
      },
      () => banner.length !== 0
    );
    return () => {
      cancel = true;
      unsubscribe();
    };
  }, [banner.length, update.count]);

  const { textColorOnMain } = useThemeColor();
  const handleClick = useCallback(
    async (i: number) => {
      const item = banner[i];
      if (!item) return;
      const { type, id } = NeteaseURL.parseBannerURL(item.url);
      Log.debug("Banner clicked", item, type, id);
      switch (type) {
        case BannerType.song: {
          if (player.current.track?.id === id) return;
          const track = await NeteaseServices.Track.idEnsure(id);
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
          ElectronServices.IPC.Event.normal.openExternalLink({
            url: item.url,
            title: item.typeTitle
          });
          return;
        }
        case BannerType.playlist: {
          navigate(RoutePathMain.playlist.withQuery(id, PlaylistSource.Normal));
          return;
        }
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
