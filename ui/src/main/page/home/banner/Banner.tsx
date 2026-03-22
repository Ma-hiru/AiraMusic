import { FC, memo, useCallback, useEffect, useState } from "react";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { BannerType } from "@mahiru/ui/public/enum";

import Carousel from "@mahiru/ui/public/components/public/Carousel";
import { Log } from "@mahiru/ui/public/utils/dev";
import AppInstance from "@mahiru/ui/main/entry/instance";
import NCM_API from "@mahiru/ui/public/api";
import { NeteaseTrackRecord, NeteaseURL } from "@mahiru/ui/public/models/netease";
import NeteaseSource from "@mahiru/ui/public/entry/source";
import AppRenderer from "@mahiru/ui/public/entry/renderer";

const Banner: FC<object> = () => {
  const [banner, setBanner] = useState<NeteaseAPI.NeteaseBanner[]>([]);
  const player = AppInstance.usePlayer();
  useEffect(() => {
    NCM_API.Home.banner().then((result) => {
      setBanner(result.banners);
    });
  }, []);

  useAppLoaded(!!banner.length);
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
          const track = await NeteaseSource.Track.fromID(id);
          const record = new NeteaseTrackRecord({
            track,
            sourceID: -1,
            sourceName: "other"
          });
          player.playlist.add(record, "next");
          player.playlist.jump(record);
          return;
        }
        case BannerType.web: {
          AppRenderer.event.openExternalLink({
            url: item.url,
            title: item.typeTitle
          });
          return;
        }
      }
    },
    [banner, player]
  );
  return (
    <div className="w-full px-2">
      <Carousel
        className="h-56"
        items={banner.map((b) => ({
          url: b.bigImageUrl,
          title: b.typeTitle
        }))}
        titleColor={textColorOnMain.string()}
        onClick={handleClick}
      />
    </div>
  );
};
export default memo(Banner);
