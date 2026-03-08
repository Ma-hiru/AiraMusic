import NeteaseAPI from "@mahiru/ui/public/api";

interface NeteaseTrackModel extends NeteaseAPI.NeteaseTrackBase {
  /** 专辑，如果是DJ节目(dj_type != 0)或者无专辑信息(single == 1)，则专辑id为0 */
  al: NeteaseAPI.Al;
  ar: NeteaseAPI.Ar[];
  /** None或如"04", "1/2", "3", "null"的字符串，表示歌曲属于专辑中第几张CD，对应音频文件的Tag */
  cd: string | null | "null";
  cf: string;
  copyright: number;
  cp: number;
  crbt: null;
  displayReason: null;
  displayTags: null;
  djId: number;
  entertainmentTags: null;
  /**
   * @enum
   *   0: 免费或无版权
   *   1: VIP 歌曲
   *   4: 购买专辑
   *   8: 非会员可免费播放低音质，会员可播放高音质及下载
   * @note fee 为 1 或 8 的歌曲均可单独购买 2 元单曲
   * */
  fee: 0 | 1 | 4 | 8;
  ftype: number;
  mainTitle: null;
  mst: number;
  /** 非零表示有MV ID */
  mv: number;
  /** 表示歌曲属于CD中第几曲，0表示没有这个字段，对应音频文件的Tag */
  no: number;
  noCopyrightRcmd: null;
  /**
   * @enum
   *   0: 未知
   *   1: 原曲
   *   2: 翻唱
   * */
  originCoverType: 0 | 1 | 2;
  originSongSimpleData: null;
  /** 小数，常取[0.0, 100.0]中离散的几个数值, 表示歌曲热度 */
  pop: number;
  pst: number;
  pubDJProgramData: null;
  /** 毫秒为单位的Unix时间戳 */
  publishTime: number;
  resourceState: boolean;
  rt: null | string;
  rtUrl: null;
  rtUrls: string[];
  rtype: number;
  rurl: null;
  s_id: number;
  single: number;
  songJumpInfo: null;
  st: number;
  /**
   * @author tuxzz[https://github.com/Binaryify/NeteaseCloudMusicApi/issues/1121#issuecomment-774438040]:
   * @enum {number}
   * @readonly
   * 0: 一般类型
   * 1: 通过云盘上传的音乐，网易云不存在公开对应
   *    - 如果没有权限将不可用，除了歌曲长度以外大部分信息都为 null。
   *    - 可以通过 `/api/v1/playlist/manipulate/tracks` 接口添加到播放列表。
   *    - 如果添加到“我喜欢的音乐”，则仅自己可见，除了长度以外各种信息均为未知，且无法播放。
   *    - 如果添加到一般播放列表，虽然返回 code 200，但是并没有效果。
   *    - 网页端打开会看到 404 画面。
   *    - 例子: https://music.163.com/song/1345937107
   * 2: 通过云盘上传的音乐，网易云存在公开对应
   *    - 如果没有权限则只能看到信息，但无法直接获取到文件。
   *    - 可以通过 `/api/v1/playlist/manipulate/tracks` 接口添加到播放列表。
   *    - 如果添加到“我喜欢的音乐”，则仅自己可见，且无法播放。
   *    - 如果添加到一般播放列表，则自己会看到显示“云盘文件”，且云盘会多出其对应的网易云公开歌曲。其他人看到的是其对应的网易云公开歌曲。
   *    - 网页端打开会看到 404 画面。
   *    - 例子: https://music.163.com/song/435005015
   */
  t: 0 | 1 | 2;
  tagPicList: null;
  tns?: string[];
  /** 常为[1, ?]任意数字, 代表歌曲当前信息版本 */
  v: number;
  version: number;
  /** 注入字段 */
  privilege: NeteaseAPI.NeteaseTrackPrivilege | null;
  /** 注入字段 */
  playable: boolean;
  /** 注入字段 */
  reason: string;
}

export default class NeteaseTrack implements NeteaseTrackModel {
  al: { picUrl: string; name: string };
  alia?: string[];
  ar: { id: number; name: string }[];
  dt: number;
  h: NeteaseAPI.H | null;
  hr: NeteaseAPI.Hr | null;
  id: number;
  l: NeteaseAPI.L | null;
  m: NeteaseAPI.M | null;
  mark: number;
  name: string;
  playDuration?: number;
  playable: boolean;
  reason: string;
  recordTime?: number;
  sq: NeteaseAPI.Sq | null;
  tns?: string[];

  constructor(props: NeteaseAPI.NeteaseTrackBase) {
    this.al = props.al;
    this.alia = props.alia;
    this.ar = props.ar;
    this.dt = props.dt;
    this.h = props.h;
    this.hr = props.hr;
    this.id = props.id;
    this.l = props.l;
    this.m = props.m;
    this.mark = props.mark;
    this.name = props.name;
    this.playDuration = props.playDuration;
    this.playable = props.playable;
    this.reason = props.reason;
    this.recordTime = props.recordTime;
    this.sq = props.sq;
    this.tns = props.tns;
  }

  static fromNeteaseAPI(apiTrack: NeteaseAPI.NeteaseTrackBase) {
    return new NeteaseTrack(apiTrack);
  }
}
