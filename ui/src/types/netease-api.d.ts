/**
 * 歌手的基础信息，常见于 `/song/detail`、`/artist` 等接口。
 * 来源：temp/src/api/track.js#getTrackDetail、temp/src/api/artist.js#getArtist。
 */
export interface NeteaseArtistSummary {
  id: number;
  name: string;
  picUrl?: string;
  alias?: string[];
  /** 保留原始接口的其余字段，方便未来扩展。 */
  [key: string]: any;
}

/**
 * 嵌入在歌曲数据中的专辑简介。
 * 来源：temp/src/api/track.js#getTrackDetail、temp/src/utils/db.js#cacheTrackSource。
 */
export interface NeteaseAlbumSummary {
  id: number;
  name: string;
  picUrl: string;
  /** 专辑别名列表。 */
  alia?: string[];
  /** 一些专辑会返回翻译名称。 */
  transNames?: string[];
  /** 其他暂未使用的字段。 */
  [key: string]: any;
}

export interface ChargeInfoList {
  chargeMessage: null;
  chargeType: number;
  chargeUrl: null;
  rate: number;
  [property: string]: any;
}

export interface FreeTrialPrivilege {
  cannotListenReason: null;
  freeLimitTagType: null;
  listenType: null;
  playReason: null;
  resConsumable: boolean;
  userConsumable: boolean;
  [property: string]: any;
}

/**
 * 歌曲可播/版权信息，搭配 `mapTrackPlayableStatus` 使用。
 * 来源：temp/src/api/track.js#getTrackDetail、temp/src/utils/common.js#isTrackPlayable。
 */
export interface NeteaseTrackPrivilege {
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

/**
 * `/song/detail` 返回的下架版权提示信息。
 * 来源：temp/src/utils/common.js#isTrackPlayable。
 */
export interface NeteaseNoCopyrightRcmd {
  type: number;
  typeDesc: string;
  [key: string]: any;
}

/**
 * `/song/detail` 返回体。
 */
export interface NeteaseTrackDetailResponse {
  songs: NeteaseTrack[];
  privileges: NeteaseTrackPrivilege[];
  code?: number;
}

/**
 * `/song/url` 返回体。
 */
export interface NeteaseSongUrlItem {
  id: number;
  url: string | null;
  br: number;
  size: number;
  type: string;
  encodeType?: string;
  /** 试听片段附加信息。 */
  freeTrialInfo?: Record<string, any> | null;
  /** 其他 CDN 相关信息，UI 暂未使用。 */
  [key: string]: any;
}

export interface NeteaseSongUrlResponse {
  data: NeteaseSongUrlItem[];
  code: number;
}

export interface NeteaseKlyric {
  lyric: string;
  version: number;
}

export interface NeteaseLrc {
  lyric: string;
  version: number;
}

export interface NeteaseRomalrc {
  lyric: string;
  version: number;
  [property: string]: any;
}

export interface NeteaseTlyric {
  lyric: string;
  version: number;
  [property: string]: any;
}

export interface NeteaseTransUser {
  demand: number;
  id: number;
  nickname: string;
  status: number;
  uptime: number;
  userid: number;
}

/**
 * 歌词接口 `/lyric` 返回体，同时也是 IndexedDB 的缓存结构。
 */
export interface NeteaseLyricResponse {
  code: number;
  /** 逐字歌词 QRC （逐字格式）*/
  klyric?: NeteaseKlyric;
  /** 主歌词 LRC */
  lrc?: NeteaseLrc;
  /** 罗马音歌词 LRC（罗马拼音）*/
  romalrc?: NeteaseRomalrc;
  /** 歌词同步、翻译质量相关标志 */
  qfy: boolean;
  /** 歌词同步、翻译质量相关标志 */
  sfy: boolean;
  /** 歌词同步、翻译质量相关标志 */
  sgc: boolean;
  /** 翻译歌词 LRC（翻译版）*/
  tlyric?: NeteaseTlyric;
  /** 提供歌词/翻译的用户信息 */
  transUser: NeteaseTransUser;
}

/**
 * `/album` 返回的完整专辑内容，也会被缓存到 IndexedDB。
 */
export interface NeteaseAlbumDetailResponse {
  album: NeteaseAlbumSummary & {
    description?: string;
    publishTime?: number;
    company?: string;
    artists?: NeteaseArtistSummary[];
    size?: number;
  };
  songs: NeteaseTrackDetail[];
  code: number;
  [key: string]: any;
}

/**
 * `/playlist/detail` 中 `trackIds` 的单条结构。
 */
export interface NeteasePlaylistTrackRef {
  id: number;
  v: number;
  t?: number;
  [key: string]: any;
}

/**
 * 歌单详情主体。
 */
export interface Creator {
  accountStatus: number;
  anchor: boolean;
  authenticationTypes: number;
  authority: number;
  authStatus: number;
  avatarDetail: null;
  avatarImgId: number;
  avatarImgId_str: string;
  avatarImgIdStr: string;
  avatarUrl: string;
  backgroundImgId: number;
  backgroundImgIdStr: string;
  backgroundUrl: string;
  birthday: number;
  city: number;
  defaultAvatar: boolean;
  description: string;
  detailDescription: string;
  djStatus: number;
  experts: null;
  expertTags: null;
  followed: boolean;
  gender: number;
  mutual: boolean;
  nickname: string;
  province: number;
  remarkName: null;
  signature: string;
  userId: number;
  userType: number;
  vipType: number;
}

export interface TrackId {
  alg: null;
  at: number;
  dpr: null;
  f: null;
  id: number;
  rcmdReason: string;
  rcmdReasonTitle: string;
  sc: null;
  sr: null;
  t: number;
  tr: number;
  uid: number;
  v: number;
}

export interface NeteaseTrack {
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

export interface Al {
  id: number;
  name: string;
  pic: number;
  pic_str?: string;
  picUrl: string;
  /** 注入字段 */
  cachedPicUrl: string;
  /** 注入字段 */
  cachedPicUrlID: string;
  tns: string[];
}

export interface Ar {
  alias: string[];
  id: number;
  name: string;
  tns: string[];
}

export interface H {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

export interface L {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

export interface M {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

export interface Sq {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

export interface NeteasePlaylistDetail {
  adType: number;
  algTags: null;
  backgroundCoverId: number;
  backgroundCoverUrl: null;
  bannedTrackIds: null;
  bizExtInfo: { [key: string]: any };
  cloudTrackCount: number;
  commentCount: number;
  commentThreadId: string;
  copied: boolean;
  coverImgId: number;
  coverImgId_str: null;
  coverImgUrl: string;
  coverStatus: number;
  createTime: number;
  creator: Creator;
  description: null;
  detailPageTitle: null;
  displayTags: null;
  displayUserInfoAsTagOnly: boolean;
  distributeTags: string[];
  englishTitle: null;
  gradeStatus: string;
  highQuality: boolean;
  historySharedUsers: null;
  id: number;
  mixPodcastPlaylist: boolean;
  mvResourceInfos: null;
  name: string;
  newDetailPageRemixVideo: null;
  newImported: boolean;
  officialPlaylistType: null;
  opRecommend: boolean;
  ordered: boolean;
  playCount: number;
  playlistType: string;
  podcastTrackCount: number;
  privacy: number;
  relateResType: null;
  remixVideo: null;
  score: null;
  shareCount: number;
  sharedUsers: null;
  specialType: number;
  status: number;
  subscribed: boolean;
  subscribedCount: number;
  subscribers: string[];
  tags: string[];
  titleImage: number;
  titleImageUrl: null;
  trackCount: number;
  trackIds: TrackId[];
  trackNumberUpdateTime: number;
  tracks: NeteaseTrack[];
  trackUpdateTime: number;
  trialMode: number;
  updateFrequency: null;
  updateTime: number;
  userId: number;
  videoIds: null;
  videos: null;
}

export interface NeteasePlaylistDetailResponse {
  code?: number;
  fromUserCount?: number;
  fromUsers?: null;
  playlist: NeteasePlaylistDetail;
  privileges: NeteaseTrackPrivilege[];
  relatedVideos?: null;
  resEntrance?: null;
  sharedPrivilege?: null;
  songFromUsers?: null;
  urls?: null;
}

/**
 * `/recommend/songs` 返回的每日推荐歌曲列表。
 */
export interface NeteaseDailySongsResponse {
  data: {
    dailySongs: NeteaseTrackDetail[];
    privileges: NeteaseTrackPrivilege[];
    [key: string]: any;
  };
  code: number;
  [key: string]: any;
}

/**
 * `/personal_fm` 返回的私人 FM 列表。
 */
export interface NeteasePersonalFMResponse {
  data: NeteaseTrackDetail[];
  code: number;
  [key: string]: any;
}

/**
 * `getArtist` 使用的歌手详情结构。
 */
export interface NeteaseArtistDetailResponse {
  artist: NeteaseArtistSummary & {
    musicSize?: number;
    albumSize?: number;
    mvSize?: number;
  };
  hotSongs: NeteaseTrackDetail[];
  more: boolean;
  code: number;
  [key: string]: any;
}

/**
 * `/user/cloud` 返回的云盘音轨摘要。
 */
export interface NeteaseCloudDiskTrack {
  songId: number;
  fileName: string;
  artist: string;
  album: string;
  simpleSong?: NeteaseTrackDetail;
  /** 文件大小（字节）。 */
  fileSize: number;
  /** 其余原始字段。 */
  [key: string]: any;
}

export interface NeteaseCloudDiskResponse {
  data: NeteaseCloudDiskTrack[];
  count: number;
  code: number;
  [key: string]: any;
}

/**
 * `/likelist` 返回的已喜欢歌曲 ID 列表。
 */
export interface NeteaseLikedSongIdsResponse {
  ids: number[];
  /** 时间戳 */
  checkPoint: number;
  code: number;
}

/**
 * 仅返回状态码/简单结果的接口通用结构。
 */
export interface NeteaseStatusResponse {
  code: number;
  [key: string]: any;
}

/**
 * `/search` 在歌曲场景下的返回体。
 */
export interface NeteaseSearchSongResponse {
  result: {
    song?: {
      songs: NeteaseTrackDetail[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  code: number;
  [key: string]: any;
}

/**
 * `/top/song` 返回的新歌速递列表。
 */
export interface NeteaseTopSongResponse {
  data: NeteaseTrackDetail[];
  code: number;
  [key: string]: any;
}

/**
 * `/album/detail/dynamic` 返回的专辑动态信息。
 */
export interface NeteaseAlbumDynamicResponse {
  isSub?: boolean;
  commentCount?: number;
  shareCount?: number;
  code: number;
  [key: string]: any;
}

/**
 * `/artist/album` 返回的歌手专辑列表。
 */
export interface NeteaseArtistAlbumResponse {
  hotAlbums: Array<NeteaseAlbumDetailResponse["album"]>;
  more: boolean;
  code: number;
  [key: string]: any;
}

export interface RecommendInfo {
  alg: string;
  firstSongId: null;
  logInfo: string;
  reason: null;
  relatedId: string;
  relatedType: string;
}

/**
 * `/top/playlist`、`/top/playlist/highquality` 返回的歌单摘要。
 */
export interface NeteasePlaylistSummary {
  adType: number;
  anonimous: boolean;
  artists: null;
  backgroundCoverId: number;
  backgroundCoverUrl: null | string;
  cloudTrackCount: number;
  commentThreadId: string;
  containsTracks: boolean;
  copied: boolean;
  coverImgId: number;
  coverImgId_str: null | string;
  coverImgUrl: string;
  /** 注入字段 */
  cachedCoverImgUrl: string;
  /** 注入字段 */
  cachedCoverImgUrlID: string;
  createTime: number;
  creator: Creator;
  description: null | string;
  englishTitle: null | string;
  highQuality: boolean;
  id: number;
  name: string;
  newImported: boolean;
  opRecommend: boolean;
  ordered: boolean;
  playCount: number;
  privacy: number;
  recommendInfo: null | RecommendInfo;
  sharedUsers: null;
  shareStatus: null;
  specialType: number;
  status: number;
  subscribed: boolean;
  subscribedCount: number;
  subscribers: string[];
  tags: string[];
  titleImage: number;
  titleImageUrl: null | string;
  top: boolean;
  totalDuration: number;
  trackCount: number;
  trackNumberUpdateTime: number;
  tracks: null;
  trackUpdateTime: number;
  updateFrequency: null | string;
  updateTime: number;
  userId: number;
}

/**
 * `/user/detail` 返回的用户详情。
 */
export interface NeteaseUserDetailResponse {
  level: number;
  listenSongs: number;
  userPoint: {
    userId: number;
    balance: number;
    updateTime: number;
    version: number;
    status: number;
    blockBalance: number;
  };
  mobileSign: boolean;
  pcSign: boolean;
  profile: {
    privacyItemUnlimit: {
      area: boolean;
      college: boolean;
      gender: boolean;
      age: boolean;
      villageAge: boolean;
    };
    avatarDetail: null;
    defaultAvatar: boolean;
    followed: boolean;
    nickname: string;
    authStatus: number;
    expertTags: null;
    experts: object;
    avatarUrl: string;
    backgroundImgId: number;
    backgroundUrl: string;
    userType: number;
    city: number;
    djStatus: number;
    detailDescription: string;
    gender: number;
    avatarImgId: number;
    vipType: number;
    mutual: boolean;
    remarkName: null;
    province: number;
    accountStatus: number;
    avatarImgIdStr: string;
    backgroundImgIdStr: string;
    description: string;
    createTime: number;
    userId: number;
    birthday: number;
    signature: string;
    authority: number;
    followeds: number;
    follows: number;
    blacklist: boolean;
    eventCount: number;
    allSubscribedCount: number;
    playlistBeSubscribedCount: number;
    followTime: null;
    followMe: boolean;
    artistIdentity: [];
    cCount: number;
    inBlacklist: boolean;
    sDJPCount: number;
    playlistCount: number;
    sCount: number;
    newFollows: number;
  };
  peopleCanSeeMyPlayRecord: boolean;
  bindings: {
    expiresIn: number;
    refreshTime: number;
    bindingTime: number;
    tokenJsonStr: null;
    url: string;
    expired: boolean;
    userId: number;
    id: number;
    type: number;
  }[];
  adValid: boolean;
  code: number;
  newUser: boolean;
  recallUser: boolean;
  createTime: number;
  createDays: number;
  profileVillageInfo: {
    title: number;
    imageUrl: null | string;
    targetUrl: string;
  };
}

/**
 * `/user/playlist` 返回的歌单集合。
 */
export interface NeteaseUserPlaylistResponse {
  playlist: NeteasePlaylistSummary[];
  code: number;
  more: boolean;
}

/**
 * `/user/record` 返回的听歌记录。
 */
export interface NeteaseUserRecordResponse {
  weekData?: Array<{
    song: NeteaseTrackDetail;
    playCount: number;
    score?: number;
    [key: string]: any;
  }>;
  allData?: Array<{
    song: NeteaseTrackDetail;
    playCount: number;
    score?: number;
    [key: string]: any;
  }>;
  code: number;
  [key: string]: any;
}

/**
 * `/user/account` 返回的账号信息。
 */
export interface NeteaseUserAccountResponse {
  code: number;
  account: {
    id: number;
    userName: string;
    type: number;
    status: number;
    whitelistAuthority: number;
    createTime: number;
    tokenVersion: number;
    ban: number;
    baoyueVersion: number;
    donateVersion: number;
    vipType: number;
    anonimousUser: boolean;
    paidFee: boolean;
  };
  profile: {
    userId: number;
    userType: number;
    nickname: "仲商贰肆";
    avatarImgId: number;
    avatarUrl: string;
    backgroundImgId: number;
    backgroundUrl: string;
    signature: string;
    createTime: number;
    userName: string;
    accountType: number;
    shortUserName: string;
    birthday: number;
    authority: number;
    gender: number;
    accountStatus: number;
    province: number;
    city: number;
    authStatus: number;
    description: null;
    detailDescription: null;
    defaultAvatar: boolean;
    expertTags: null;
    experts: null;
    djStatus: number;
    locationStatus: number;
    vipType: number;
    followed: boolean;
    mutual: boolean;
    authenticated: boolean;
    lastLoginTime: number;
    lastLoginIP: string;
    remarkName: null;
    viptypeVersion: number;
    authenticationTypes: number;
    avatarDetail: null;
    anchor: boolean;
  };
}

/**
 * `/login`、`/login/cellphone` 返回的登录结果。
 */
export interface NeteaseLoginResponse {
  code: number;
  token?: string;
  cookie?: string;
  profile?: NeteaseUserDetailResponse["profile"];
  account?: NeteaseUserAccountResponse["account"];
  [key: string]: any;
}

/**
 * `/login/qr/key` 返回的二维码 key。
 */
export interface NeteaseLoginQrKeyResponse {
  data: {
    unikey: string;
    qrurl?: string;
    [key: string]: any;
  };
  // 状态码
  code: number;
  [key: string]: any;
}

/**
 * `/login/qr/create` 返回的二维码图片/链接。
 */
export interface NeteaseLoginQrCreateResponse {
  data: {
    qrurl: string;
    qrimg?: string;
    [key: string]: any;
  };
  code: number;
  [key: string]: any;
}

/**
 * `/login/qr/check` 返回的二维码登录状态。
 */
export interface NeteaseLoginQrCheckResponse {
  code: number;
  message?: string;
  cookie: string;
  nickname?: string;
  avatarUrl?: string;
  [key: string]: any;
}

/**
 * `/mv/detail` 返回的 MV 信息。
 */
export interface NeteaseMVDetailResponse {
  data: {
    id: number;
    name: string;
    artistId: number;
    artistName: string;
    cover: string;
    playCount: number;
    publishTime: string;
    brs: Array<{ br: number; size?: number; [key: string]: any }>;
    videoGroup?: Array<{ id: number; name: string; [key: string]: any }>;
    [key: string]: any;
  };
  subed?: boolean;
  code: number;
  [key: string]: any;
}

/**
 * `/mv/url` 返回的播放地址。
 */
export interface NeteaseMVUrlResponse {
  data: {
    id: number;
    url: string;
    r: number;
    size?: number;
    md5?: string;
    [key: string]: any;
  };
  code: number;
  [key: string]: any;
}

/**
 * `/simi/mv` 返回的相似 MV 列表。
 */
export interface NeteaseSimiMVResponse {
  mvs: Array<{
    id: number;
    name: string;
    cover: string;
    artistName: string;
    duration: number;
    playCount?: number;
    [key: string]: any;
  }>;
  code: number;
  [key: string]: any;
}

/**
 * `/album/sublist` 返回的收藏专辑列表。
 */
export interface NeteaseLikedAlbumsResponse {
  data: Array<NeteaseAlbumDetailResponse["album"] & { subTime?: number; [key: string]: any }>;
  hasMore?: boolean;
  count?: number;
  code: number;
  [key: string]: any;
}

/**
 * `/artist/sublist` 返回的收藏歌手列表。
 */
export interface NeteaseLikedArtistsResponse {
  data: Array<NeteaseArtistSummary & { accountId?: number; trans?: string; [key: string]: any }>;
  hasMore?: boolean;
  count?: number;
  code: number;
  [key: string]: any;
}

/**
 * `/mv/sublist` 返回的收藏 MV 列表。
 */
export interface NeteaseLikedMVsResponse {
  data: Array<{
    id: number;
    name: string;
    coverUrl: string;
    artistName: string;
    duration: number;
    [key: string]: any;
  }>;
  hasMore?: boolean;
  count?: number;
  code: number;
  [key: string]: any;
}

/**
 * `/user/cloud/detail` 返回的云盘歌曲详情。
 */
export interface NeteaseCloudDiskTrackDetailResponse {
  data: {
    songId: number;
    simpleSong?: NeteaseTrackDetail;
    fileName?: string;
    [key: string]: any;
  } | null;
  code: number;
  [key: string]: any;
}
