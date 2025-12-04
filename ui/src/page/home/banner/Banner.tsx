import Carousel from "@mahiru/ui/componets/public/Carousel";
import { FC, memo, useCallback, useEffect, useState } from "react";
import { homeBanner } from "@mahiru/ui/api/recommend";
import { NeteaseBanner } from "@mahiru/ui/types/netease/banner";
import { EqError, Log } from "@mahiru/ui/utils/dev";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { getTrackDetail } from "@mahiru/ui/api/track";
import { NeteaseTrackPrivilegesStatusFilter } from "@mahiru/ui/utils/filter";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useAppLoaded } from "@mahiru/ui/hook/useAppLoaded";

const Banner: FC<object> = () => {
  const [banner, setBanner] = useState<NeteaseBanner[]>([]);
  const { addAndPlayTrack } = usePlayer();
  useEffect(() => {
    homeBanner().then((result) => {
      setBanner(result.banners);
    });
  }, []);
  useAppLoaded(!!banner.length);
  const titleColor = useTextColorOnThemeColor();
  const handleClick = useCallback(
    async (i: number) => {
      const item = banner[i];
      if (!item) return;
      const { type, id } = parseBannerURL(item.url);
      switch (type) {
        case "song": {
          const detail = await getTrackDetail(id);
          const tracks = NeteaseTrackPrivilegesStatusFilter(detail.songs, detail.privileges);
          const track = tracks[0];
          if (track && track.playable) {
            addAndPlayTrack({
              id: track.id,
              title: track.name,
              artist: track.ar,
              album: track.al,
              cover: track.al.picUrl,
              audio: "",
              alias: track.alia[0] || "",
              tsTitle: track.tns?.[0] || "",
              raw: track
            });
          }
          return;
        }
        case "web": {
          window.node.event.openExternalLink({
            url: item.url,
            title: item.typeTitle
          });
          return;
        }
      }
    },
    [addAndPlayTrack, banner]
  );
  return (
    <div className="w-full px-2">
      <Carousel
        className="h-56"
        items={banner.map((b) => ({
          url: b.bigImageUrl,
          title: b.typeTitle
        }))}
        titleColor={titleColor}
        onClick={handleClick}
      />
    </div>
  );
};
export default memo(Banner);

type BannerType = "song" | "album" | "web" | "unknown";

function parseBannerURL(url: string): { type: BannerType; id: number } {
  // 独家策划 https://y.music.163.com/g/yida/act/qianxi?page=50ccea950b38445f98458d3fc61ad72b
  // 新歌首发 orpheus://song/3322319846
  // 数字专辑 https://music.163.com/store/newalbum/detail?id=349048250
  // 新碟首发 orpheus://album/351342148 \ https://music.163.com/#/album?id=352637538
  // 新歌首发 orpheus://song/3321723289
  // 热歌推荐 orpheus://song/3322410882
  const isOrpheus = url.startsWith("orpheus");
  const isHttp = url.startsWith("http");
  try {
    if (isOrpheus) {
      const [type = "unknown", id = 0] = url.split("://")[1]!.split("/")!;
      return { type: type as BannerType, id: Number(id) };
    } else if (isHttp) {
      const u = new URL(url);
      const id = u.searchParams.get("id") || "0";
      if (u.pathname.includes("album") || u.pathname.includes("newalbum")) {
        return { type: "album", id: Number(id) };
      } else if (u.pathname.includes("song")) {
        return { type: "song", id: Number(id) };
      } else {
        return { type: "web", id: Number(id) };
      }
    }
  } catch (err) {
    Log.info(
      new EqError({
        message: "parseBannerURL error",
        raw: err,
        label: "parseBannerURL"
      })
    );
  }
  return { type: "unknown", id: 0 };
}
