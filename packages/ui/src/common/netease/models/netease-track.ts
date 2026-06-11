import { NeteaseUser, type NeteaseUserModel } from "./netease-user";
import { TrackBitmark, TrackQuality } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";

export class NeteaseTrack implements NeteaseTrackModel {
  //region NeteaseTrackModel fields
  readonly id: number;
  /** 专辑，如果是DJ节目(dj_type != 0)或者无专辑信息(single == 1)，则专辑id为0 */
  readonly al: NeteaseAPI.Al;
  readonly alia: string[];
  readonly ar: NeteaseAPI.Ar[];
  /**  */
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
  readonly privilege: Nullable<NeteaseAPI.NeteaseTrackPrivilege>;
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
  playable(user: Optional<NeteaseUser | NeteaseUserModel>) {
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
      if (NeteaseUser.isLoggedIn && NeteaseUser.isVIP(user)) {
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

  static playable(track: NeteaseTrack, user: Optional<NeteaseUser | NeteaseUserModel>) {
    return track.playable(user);
  }

  /** 解析歌曲Bitmark */
  checkBitmark(flag: TrackBitmark) {
    const mark = this?.mark;
    if (typeof mark !== "number") return false;
    return (mark & flag) === flag;
  }

  /** 获取歌曲音质信息 */
  qualities(isVip: Undefinable<boolean>) {
    const res = [];
    if (this.hr) res.push({ ...this.hr, label: TrackQuality.hr });
    if (this.sq) res.push({ ...this.sq, label: TrackQuality.sq });
    if (this.h) res.push({ ...this.h, label: TrackQuality.h });
    if (this.m) res.push({ ...this.m, label: TrackQuality.m });
    if (this.l) res.push({ ...this.l, label: TrackQuality.l });
    if (isVip !== undefined)
      return res.filter((q) => {
        return !(!isVip && (q.label === TrackQuality.sq || q.label === TrackQuality.hr));
      });
    return res;
  }

  get artist() {
    return this.ar.map((artist) => artist.name) || [];
  }

  get translate() {
    return this.tns?.[0];
  }

  get aliaName() {
    return this.alia[0];
  }

  translateAndAliaName(split = " - ") {
    return [this.translate, this.aliaName].filter(Boolean).join(split);
  }

  splitTitle() {
    const title = this.name?.trim() ?? "";
    const result = { main: title, sub: "" };
    if (!title) return result;

    const regex = /^(.*?)\s*(\([^()]*\)|（[^（）]*）|\[[^[\]]*]|【[^【】]*】|-[^-\s][^-]*-)\s*$/;
    const match = title.match(regex);
    if (!match) return result;

    result.main = match[1]?.trim() ?? "";
    result.sub =
      match[2]
        ?.trim()
        .replace(/^[（([【-]\s*/, "")
        .replace(/[）)\]】-]\s*$/, "") ?? "";

    if (result.sub === title.trim()) {
      result.main = title.trim();
      result.sub = "";
    }
    if (result.sub === result.main) {
      result.sub = "";
    }

    return result;
  }

  formatDate(split?: string) {
    return RendererFormat.time(this.publishTime, split);
  }

  formatDuration(split?: string) {
    return RendererFormat.duration(this.dt, "ms", split);
  }

  toSearchStruct() {
    return {
      id: this?.id || 0,
      name: this?.name || "",
      ar: this?.ar || [],
      alia: this?.alia || [],
      al: this?.al || { name: "" },
      tns: this?.tns || []
    };
  }

  static toSearchStructString(tracks: NeteaseTrack[]) {
    return JSON.stringify(tracks.map((track) => track.toSearchStruct()));
  }

  //region static methods
  static fromNeteaseAPI(
    apiTrack: NeteaseAPI.NeteaseTrack,
    privilege: Nullable<NeteaseAPI.NeteaseTrackPrivilege>
  ) {
    return new NeteaseTrack({ ...apiTrack, privilege });
  }

  static fromObject(object: NeteaseTrackModel | NeteaseTrack) {
    return new NeteaseTrack(object);
  }
  //endregion
}
