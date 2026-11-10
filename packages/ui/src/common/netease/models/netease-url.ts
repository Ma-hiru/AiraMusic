import { Log } from "@/common/lib/log";
import { isLoopbackHostname } from "@/common/utils/url";
import { BannerType, NeteaseImageSize } from "@/common/enum";

export class NeteaseURL {
  private static isNeteaseImageURL(url: URL) {
    return url.hostname === "music.126.net" || url.hostname.endsWith(".music.126.net");
  }

  /**
   * @desc 将非回环的 http 地址升级为 https \
   * 生产环境页面是 https://localhost，音频/封面若按接口返回的 http 地址请求，会被
   * 当作混合内容拦截（媒体不会像图片那样自动升级）\
   * 主机名交给 URL 解析器判定（能识别 `127.1`、十进制 IPv4、IPv6 等写法）；
   * 协议替换仍按原始字符串裁剪——`URL#toString` 会做默认端口省略、点段折叠、
   * 百分号编码规整，可能改写 CDN 的签名查询串 \
   * 回环地址保持原样：本地服务没有 TLS
   * */
  static toSecure(url: string): string {
    if (!url || !url.startsWith("http://")) return url;
    let hostname: string;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return url;
    }
    if (isLoopbackHostname(hostname)) return url;
    return `https://${url.slice(7)}`;
  }

  static parseBannerURL(url: string): { id: number; type: BannerType } {
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
    const types = [
      BannerType.song,
      BannerType.web,
      BannerType.album,
      BannerType.unknown,
      BannerType.playlist
    ];
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
      Log.error({
        message: "parseBannerURL error",
        raw: err,
        label: "parseBannerURL"
      });
    }
    return { type: BannerType.unknown, id: 0 };
  }

  /** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
  static setImageSize<T extends Optional<string>>(
    url: T,
    size: number | NeteaseImageSize
  ): T extends Falsy ? undefined : string {
    // 绕过 NeteaseNetworkImage 直接用裸 url 的调用点（radio/mini/mediaSession 等）
    // 也走同一套协议升级
    const source = NeteaseURL.toSecure(url ?? "");
    if (!source || !source.startsWith("http")) {
      return <T extends Falsy ? undefined : string>(source || undefined);
    }
    if (!Number.isFinite(size) || (size < 0 && size !== NeteaseImageSize.raw)) {
      return <T extends Falsy ? undefined : string>(source || undefined);
    }

    const u = new URL(source);
    if (NeteaseURL.isNeteaseImageURL(u)) {
      u.search = "";
    }

    if (size !== NeteaseImageSize.raw) {
      u.searchParams.set("param", `${size}y${size}`);
      u.searchParams.set("type", "webp");
    } else {
      u.searchParams.delete("param");
      u.searchParams.delete("type");
    }

    return <T extends Falsy ? undefined : string>u.toString();
  }

  static parseImageSize(url: string) {
    if (!url || !url.startsWith("http")) return;
    try {
      const res = new URL(url).searchParams.get("param")?.match(/^([0-9]+)y([0-9]+)$/);
      const x = Number(res?.[1]);
      const y = Number(res?.[2]);
      if (res == null || !Number.isFinite(x) || !Number.isFinite(y)) return;
      return [x, y] as const;
    } catch (err) {
      Log.error(err);
    }
  }
}
