import Dayjs from "dayjs";
import { NeteaseUser } from "./NeteaseUser";
import { TrackBitmark, TrackQuality } from "@mahiru/ui/public/enum";

export class NeteaseTrack implements NeteaseTrackModel {
  //region NeteaseTrackModel fields
  readonly id: number;
  /** 专辑，如果是DJ节目(dj_type != 0)或者无专辑信息(single == 1)，则专辑id为0 */
  readonly al: NeteaseAPI.Al;
  readonly alia: string[];
  readonly ar: NeteaseAPI.Ar[];
  readonly dt: number;
  /**
   * @enum
   *   0: 免费或无版权
   *   1: VIP 歌曲
   *   4: 购买专辑
   *   8: 非会员可免费播放低音质，会员可播放高音质及下载
   * @note fee 为 1 或 8 的歌曲均可单独购买 2 元单曲
   * */
  readonly fee: 0 | 1 | 4 | 8;
  readonly mark: number;
  /** 非零表示有MV ID */
  readonly mv: number;
  readonly name: string;
  /** 表示歌曲属于CD中第几曲，0表示没有这个字段，对应音频文件的Tag */
  readonly no: number;
  /**
   * @enum
   *   0: 未知
   *   1: 原曲
   *   2: 翻唱
   * */
  readonly originCoverType: 0 | 1 | 2;
  /** 小数，常取[0.0, 100.0]中离散的几个数值, 表示歌曲热度 */
  readonly pop: number;
  /** 毫秒为单位的Unix时间戳 */
  readonly publishTime: number;
  readonly noCopyrightRcmd: any;
  readonly h: Nullable<NeteaseAPI.H>;
  readonly hr: Nullable<NeteaseAPI.Hr>;
  readonly l: Nullable<NeteaseAPI.L>;
  readonly m: Nullable<NeteaseAPI.M>;
  readonly sq: Nullable<NeteaseAPI.Sq>;
  readonly privilege: NeteaseAPI.NeteaseTrackPrivilege;
  readonly tns?: string[];

  constructor(props: NeteaseTrackModel) {
    this.id = props.id;
    this.al = props.al;
    this.alia = props.alia;
    this.ar = props.ar;
    this.dt = props.dt;
    this.fee = props.fee;
    this.mark = props.mark;
    this.mv = props.mv;
    this.name = props.name;
    this.no = props.no;
    this.originCoverType = props.originCoverType;
    this.pop = props.pop;
    this.publishTime = props.publishTime;
    this.h = props.h;
    this.hr = props.hr;
    this.l = props.l;
    this.m = props.m;
    this.sq = props.sq;
    this.tns = props.tns;
    this.privilege = props.privilege;
  }
  //endregion

  /** 判断NeteaseTrack是否可以播放 */
  playable(user: Optional<NeteaseUser>) {
    const result = { playable: false, reason: "未知原因" };
    // 如果没有 privilege 信息，无法判断是否可播放，暂时不设置 reason
    if (!this.privilege) {
      result.reason = "无法获取权限信息";
      return result;
    }
    // 播放权限 > 0 或者用户已登录且为云盘歌曲
    if (this.privilege.pl > 0 || (NeteaseUser.isLoggedIn && this.privilege?.cs)) {
      result.playable = true;
      return result;
    }

    // 0: 免费或无版权 1: VIP 歌曲 4: 购买专辑 8: 非会员可免费播放低音质，会员可播放高音质及下载
    if (this.fee === 1 || this.privilege.fee === 1) {
      // VIP 歌曲
      if (NeteaseUser.isLoggedIn && user?.isVIP) {
        result.playable = true;
      } else {
        result.playable = false;
        result.reason = "VIP专属";
      }
    } else if (this.fee === 4 || this.privilege.fee === 4) {
      // 付费专辑
      result.playable = false;
      result.reason = "付费专辑";
    } else if (this.noCopyrightRcmd) {
      // 无版权
      result.playable = false;
      result.reason = "无版权";
    } else if (this.privilege.st && this.privilege.st < 0) {
      // st小于0时为灰色歌曲, 使用上传云盘的方法解灰后 st == 0。
      result.playable = false;
      result.reason = "已下架";
    } else {
      result.playable = true;
    }

    return result;
  }

  /** 解析歌曲Bitmark */
  checkBitmark(flag: TrackBitmark) {
    const mark = this?.mark;
    if (typeof mark !== "number") return false;
    return (mark & flag) === flag;
  }

  /** 获取歌曲音质信息 */
  quality<T extends TrackQuality | undefined>(preference: T): TrackSourceQualityReturn<T> {
    const availableQualities: (NeteaseAPI.NeteaseQualityLevels & {
      level: TrackQuality;
    })[] = [];
    // 收集可用的音质等级,从低到高
    if (this.l)
      availableQualities.push({
        ...this.l,
        level: TrackQuality.l
      });
    if (this.m)
      availableQualities.push({
        ...this.m,
        level: TrackQuality.m
      });
    if (this.h)
      availableQualities.push({
        ...this.h,
        level: TrackQuality.h
      });
    if (this.sq)
      availableQualities.push({
        ...this.sq,
        level: TrackQuality.sq
      });
    if (this.hr)
      availableQualities.push({
        ...this.hr,
        level: TrackQuality.hr
      });
    // 如果没有指定偏好质量，则返回所有可用质量，并按码率从高到低排序
    availableQualities.sort((b, a) => (a.br || 0) - (b.br || 0));
    if (preference === undefined) {
      return availableQualities as TrackSourceQualityReturn<T>;
    } else {
      // 如果指定了偏好质量，先尝试返回该质量等级
      const alreadyExits = availableQualities.find((available) => available.level === preference);
      if (alreadyExits) return alreadyExits as TrackSourceQualityReturn<T>;
      // 如果偏好质量是Hi-Res，则直接返回最高质量
      if (preference === TrackQuality.hr) {
        return availableQualities[0] as TrackSourceQualityReturn<T>;
      }
      // 否则返回最接近偏好质量的音质等级
      let selectedQuality: Undefinable<NeteaseAPI.NeteaseQualityLevels> = availableQualities[0];
      if (selectedQuality) {
        let minDiff = Math.abs((selectedQuality.br || 0) - preference);
        for (const quality of availableQualities) {
          const diff = Math.abs((quality.br || 0) - preference);
          if (diff < minDiff) {
            minDiff = diff;
            selectedQuality = quality;
          }
        }
      }
      return selectedQuality as TrackSourceQualityReturn<T>;
    }
  }

  artist() {
    return this.ar.map((artist) => artist.name);
  }

  translate() {
    return this.tns?.[0];
  }

  splitTitle() {
    const title = this.name;
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

  formatDate(time?: number, split?: string) {
    if (time) {
      const date = Dayjs(time);
      const now = Dayjs();
      split ||= "-";
      if (now.diff(date, "seconds") < 10) {
        return "刚刚";
      } else if (date.year() === now.year()) {
        return date.format(`MM${split}DD`);
      } else {
        return date.format(`YYYY${split}MM${split}DD`);
      }
    }
    return "";
  }

  formatTime(time: Optional<number>, unit: "ms" | "s" = "ms", split?: string) {
    if (!time) return "0:00";
    split ||= ":";
    let base;
    if (unit === "ms") {
      base = 1000;
    } else {
      base = 1;
    }
    const minutes = Math.floor(time / (60 * base));
    const seconds = Math.floor((time % (60 * base)) / base);
    const paddedSeconds = seconds.toString().padStart(2, "0");
    return `${minutes}${split}${paddedSeconds}`;
  }

  //region static methods
  /** 音质文本映射 */
  static qualityText(level: TrackQuality) {
    switch (level) {
      case TrackQuality.l:
        return "L";
      case TrackQuality.m:
        return "M";
      case TrackQuality.h:
        return "HD";
      case TrackQuality.sq:
        return "SQ";
      case TrackQuality.hr:
        return "Hi-Res";
    }
  }

  static fromNeteaseAPI(
    apiTrack: NeteaseAPI.NeteaseTrack,
    privilege: NeteaseAPI.NeteaseTrackPrivilege
  ) {
    return new NeteaseTrack({ ...apiTrack, privilege });
  }

  static qualityParse(meta: NeteaseAPI.NeteaseSongUrlItem) {
    if (meta.br >= TrackQuality.hr) {
      return TrackQuality.hr;
    } else if (meta.br >= TrackQuality.sq) {
      return TrackQuality.sq;
    } else if (meta.br >= TrackQuality.h) {
      return TrackQuality.h;
    } else if (meta.br >= TrackQuality.m) {
      return TrackQuality.m;
    } else {
      return TrackQuality.l;
    }
  }
  //endregion
}

//region Type Definitions
interface NeteaseTrackModel extends NeteaseAPI.NeteaseTrackBase {
  al: NeteaseAPI.Al;
  ar: NeteaseAPI.Ar[];
  fee: 0 | 1 | 4 | 8;
  mv: number;
  no: number;
  originCoverType: 0 | 1 | 2;
  pop: number;
  publishTime: number;
  noCopyrightRcmd: any;
  privilege: NeteaseAPI.NeteaseTrackPrivilege;
}

type TrackSourceQualityReturn<T extends TrackQuality | undefined> = T extends undefined
  ? (NeteaseAPI.NeteaseQualityLevels & { level: TrackQuality })[]
  : Undefinable<NeteaseAPI.NeteaseQualityLevels & { level: TrackQuality }>;
//endregion
