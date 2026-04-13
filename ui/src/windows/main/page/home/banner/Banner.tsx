import { FC, memo, useCallback, useEffect, useState } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { BannerType } from "@mahiru/ui/public/enum";

import Carousel from "@mahiru/ui/public/components/public/Carousel";
import { Log } from "@mahiru/ui/public/utils/dev";
import AppEntry from "@mahiru/ui/windows/main/entry";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import { NeteaseTrackRecord, NeteaseURL } from "@mahiru/ui/public/source/netease/models";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

const Banner: FC<object> = () => {
  const [banner, setBanner] = useState<NeteaseAPI.NeteaseBanner[]>([]);
  const player = AppEntry.usePlayer();
  useEffect(() => {
    NeteaseAPI.Home.banner().then((result) => {
      setBanner(result.banners);
    });
  }, []);

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
          const track = await NeteaseServices.Track.fromID(id);
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
          ElectronServices.Renderer.Event.normal.openExternalLink({
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
