interface NeteaseTrackDetailResponse extends NeteaseAPIResponse {
  songs: NeteaseTrack[];
  privileges: NeteaseTrackPrivilege[];
}

interface NeteaseTrack {
  a: null;
  additionalTitle: null;
  al: Al;
  alg: null;
  alia: string[];
  ar: Ar[];
  awardTags: null;
  cd: string;
  cf: string;
  copyright: number;
  cp: number;
  crbt: null;
  displayReason: null;
  displayTags: null;
  djId: number;
  dt: number;
  entertainmentTags: null;
  fee: number;
  ftype: number;
  h: H;
  hr: null;
  id: number;
  l: L;
  m: null | M;
  mainTitle: null;
  mark: number;
  mst: number;
  mv: number;
  name: string;
  no: number;
  noCopyrightRcmd: null;
  originCoverType: number;
  originSongSimpleData: null;
  pop: number;
  pst: number;
  pubDJProgramData: null;
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
  sq: Sq;
  st: number;
  t: number;
  tagPicList: null;
  tns?: string[];
  v: number;
  version: number;
  /** 注入字段 */
  privilege: NeteaseTrackPrivilege | null;
  /** 注入字段 */
  playable: boolean;
  /** 注入字段 */
  reason: string;
  /** 注入字段 */
  isLiked: boolean;
}

interface NeteaseTrackPrivilege extends NeteaseSongPrivilege {
  /** 曲目 id。 */
  id: number;
  /** 付费类型标识（0 常见为免费，非 0 表示某种付费/VIP 限制，具体取值由服务端定义）。 */
  fee: number;
  /** 状态码/状态字段（可用于判断下架/异常，具体语义由服务端实现）。 */
  st: number;
  /** 播放权限/等级（play permission）。常用判断是 pl > 0 表示可播放，pl === 0 表示不可播放。具体值大小通常与允许的播放质量/权限粒度相关，需与 maxbr、fee 等联合判断。 */
  pl: number;
  /** 下载权限/等级，dl > 0 一般表示可下载。 */
  dl: number;
  /** 当前账号是否上传到云盘。 */
  cs?: boolean;
  /** 当前帐号是否已购买/授权（数值/布尔，表示付费状态）。 */
  payed?: number;
  /** 额外的权限/标识字段（客户端常用来区分格式/位率限制等，具体含义不完全固定）。 */
  fl?: number;
  /*&* 允许的最大比特率（整数，单位通常为 bps）。 */
  maxbr?: number;
  toast?: boolean;
  /** 位掩码/标志位，可能包含多种权限或特殊标识（需查看具体实现确定各位含义）。 */
  flag?: number;
  /** 其余仍会影响可播状态但暂未明确定义的字段。 */
  bd: null;
  chargeInfoList: ChargeInfoList[];
  code: number;
  cp: number;
  dlLevel: string;
  dlLevels: null;
  downloadMaxbr: number;
  downloadMaxBrLevel: string;
  flLevel: string;
  freeTrialPrivilege: FreeTrialPrivilege;
  ignoreCache: null;
  maxBrLevel: string;
  message: null;
  paidBigBang: boolean;
  pc: null;
  playMaxbr: number;
  playMaxBrLevel: string;
  plLevel: string;
  plLevels: null;
  preSell: boolean;
  realPayed: number;
  rightSource: number;
  rscl: null;
  sp: number;
  subp: number;
}

interface ChargeInfoList {
  chargeMessage: null;
  chargeType: number;
  chargeUrl: null;
  rate: number;
}

interface FreeTrialPrivilege {
  cannotListenReason: null;
  listenType: null;
  playReason: null;
  resConsumable: boolean;
  userConsumable: boolean;
}

interface H {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

interface L {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

interface M {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

interface Sq {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

interface Hr {
  br: number;
  fid: number;
  size: number;
  sr: number;
  vd: number;
  [property: string]: any;
}

interface NeteaseDailyRecommendTracksResponse extends NeteaseAPIResponse {
  data: DailyRecommendTracksData;
}

interface DailyRecommendTracksData {
  algReturnDemote: boolean;
  dailyRecommendInfo: null;
  dailySongs: DailySong[];
  demote: boolean;
  fromCache: boolean;
  mvResourceInfos: null;
  orderSongs: string[];
  recommendReasons: RecommendReason[];
}

interface DailySong {
  a: null;
  additionalTitle: null | string;
  al: Al;
  alg: string;
  alia: string[];
  ar: Ar[];
  awardTags: null;
  cd: string;
  cf: string;
  copyright: number;
  cp: number;
  crbt: null;
  displayTags: null;
  djId: number;
  dt: number;
  entertainmentTags: null;
  fee: number;
  ftype: number;
  h: H;
  hr: null | Hr;
  id: number;
  l: L;
  m: M;
  mainTitle: null | string;
  mark: number;
  mst: number;
  mv: number;
  name: string;
  no: number;
  noCopyrightRcmd: null;
  originCoverType: number;
  originSongSimpleData: null;
  pop: number;
  privilege: NeteaseTrackPrivilege;
  pst: number;
  publishTime: number;
  reason: null | string;
  recommendReason: null | string;
  resourceState: boolean;
  rt: null | string;
  rtUrl: null;
  rtUrls: string[];
  rtype: number;
  rurl: null;
  s_id: number;
  single: number;
  songJumpInfo: null;
  sq: Sq;
  st: number;
  t: number;
  tagPicList: null;
  tns: string[];
  v: number;
  version: number;
}

interface ChargeInfoList {
  chargeMessage: null;
  chargeType: number;
  chargeUrl: null;
  rate: number;
}

interface RecommendReason {
  reason: string;
  reasonId: string;
  songId: number;
  targetUrl: null;
}
