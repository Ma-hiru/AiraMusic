import { FC, memo, useCallback, useEffect, useState } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { API } from "@mahiru/ui/public/api";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { NeteaseTrack } from "@mahiru/ui/public/entry/track";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { Str } from "@mahiru/ui/public/entry/str";
import { BannerType } from "@mahiru/ui/public/enum";

import Carousel from "@mahiru/ui/public/components/public/Carousel";
import { Log } from "@mahiru/ui/public/utils/dev";

const Banner: FC<object> = () => {
  const [banner, setBanner] = useState<NeteaseBanner[]>([]);
  const { PlayerCoreGetter } = usePlayerStore(["PlayerCoreGetter"]);
  const player = PlayerCoreGetter();
  useEffect(() => {
    API.Recommend.homeBanner().then((result) => {
      setBanner(result.banners);
    });
  }, []);
  useAppLoaded(Boolean(banner.length));

  const { textColorOnMain } = useThemeColor();
  const handleClick = useCallback(
    async (i: number) => {
      const item = banner[i];
      if (!item) return;
      const { type, id } = Str.parseBannerURL(item.url);
      Log.trace("Banner clicked", item, type, id);
      switch (type) {
        case BannerType.song: {
          const detail = await API.Track.getTrackDetail(id);
          const tracks = NeteaseTrack.tracksPrivilegeExtends(detail.songs, detail.privileges);
          const track = tracks[0];
          if (track && track.playable) {
            player?.addTrack(track, track.al.id, "next");
            player?.next(true);
          }
          return;
        }
        case BannerType.web: {
          Renderer.event.openExternalLink({
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
