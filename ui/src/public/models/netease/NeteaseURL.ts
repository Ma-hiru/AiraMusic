import { BannerType, NeteaseImageSize } from "@mahiru/ui/public/enum";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";

export default class NeteaseURL {
  static parseBannerURL(url: string): { type: BannerType; id: number } {
    // examples:
    // 独家策划 https://y.music.163.com/g/yida/act/qianxi?page=50ccea950b38445f98458d3fc61ad72b
    // 新歌首发 orpheus://song/3322319846
    // 数字专辑 https://music.163.com/store/newalbum/detail?id=349048250
    // 新碟首发 orpheus://album/351342148 \ https://music.163.com/#/album?id=352637538
    // 新歌首发 orpheus://song/3321723289
    // 热歌推荐 orpheus://song/3322410882
    const isOrpheus = url.startsWith("orpheus");
    const isHttp = url.startsWith("http");
    const unknown = { type: BannerType.unknown, id: 0 };
    const types = [BannerType.song, BannerType.web, BannerType.album, BannerType.unknown];
    try {
      if (isOrpheus) {
        const [type, id] = url.split("://")[1]!.split("/")!;
        if (!type || !id) return unknown;
        if (!types.includes(<BannerType>type) || !Number.isFinite(Number(id))) return unknown;
        return { type: <BannerType>type, id: Number(id) };
      } else if (isHttp) {
        const u = new URL(url);
        const id = u.searchParams.get("id") || "0";
        if (u.pathname.includes("album") || u.pathname.includes("newalbum")) {
          return { type: BannerType.album, id: Number(id) };
        } else if (u.pathname.includes("song")) {
          return { type: BannerType.song, id: Number(id) };
        } else {
          return { type: BannerType.web, id: Number(id) };
        }
      }
    } catch (err) {
      Log.error(
        new EqError({
          message: "parseBannerURL error",
          raw: err,
          label: "parseBannerURL"
        })
      );
    }
    return { type: BannerType.unknown, id: 0 };
  }

  /** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
  static setImageSize<T extends Optional<string>>(
    url: T,
    size: NeteaseImageSize | number
  ): T extends Falsy ? undefined : string {
    if (!url || !url.startsWith("http")) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }
    if (!Number.isFinite(size) || size < 0) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }

    const u = new URL(url);
    if (size !== NeteaseImageSize.raw) {
      u.searchParams.set("param", `${size}y${size}`);
      u.searchParams.set("type", "webp");
    } else {
      u.searchParams.delete("param");
      u.searchParams.delete("type");
    }

    return <T extends Falsy ? undefined : string>u.toString();
  }
}
