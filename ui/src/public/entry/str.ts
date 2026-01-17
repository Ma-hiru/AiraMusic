import { commonEmojiMap } from "@mahiru/ui/public/constants/emoji";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { BannerType } from "@mahiru/ui/public/enum";

export class StrClass {
  splitTrackTitle(title?: string) {
    const result = { main: title?.trim() || "", sub: "" };
    if (!title) return result;

    const regex = /^(.*?)\s*(\([^()]*\)|（[^（）]*）|\[[^[\]]*]|【[^【】]*】|-[^-\s][^-]*-)\s*$/;
    const match = title.match(regex);
    if (!match) return result;

    result.main = match[1]?.trim() || "";
    result.sub =
      match[2]
        ?.trim()
        .replace(/^[（([【-]\s*/, "")
        .replace(/[）)\]】-]\s*$/, "") || "";

    if (result.sub === title.trim()) {
      result.main = title.trim();
      result.sub = "";
    }

    return result;
  }

  parseCommentEmoji(text: string): string {
    if (!text || !text.includes("[")) return text;

    return text.replace(/\[([^[\]]+)]/g, (raw, name) => {
      return commonEmojiMap[name] ?? raw;
    });
  }

  parseBannerURL(url: string): { type: BannerType; id: number } {
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
      Log.info(
        new EqError({
          message: "parseBannerURL error",
          raw: err,
          label: "parseBannerURL"
        })
      );
    }
    return { type: BannerType.unknown, id: 0 };
  }
}

export const Str = new StrClass();
