/**
 * React UI 侧复用的网易云接口类型定义。
 * 数据结构来自 `temp/src` 的原始 Vue 代码以及 NeteaseCloudMusicApi 的返回体。
 */

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

/**
 * 歌曲可播/版权信息，搭配 `mapTrackPlayableStatus` 使用。
 * 来源：temp/src/api/track.js#getTrackDetail、temp/src/utils/common.js#isTrackPlayable。
 */
export interface NeteaseTrackPrivilege {
  id: number;
  fee: number;
  st: number;
  pl: number;
  dl: number;
  /** 当前账号是否上传到云盘。 */
  cs?: boolean;
  /** 付费/VIP 授权标记。 */
  payed?: number;
  fl?: number;
  maxbr?: number;
  toast?: boolean;
  flag?: number;
  /** 其余仍会影响可播状态但暂未明确定义的字段。 */
  [key: string]: any;
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
 * `/song/detail`、`/album` 返回的歌曲结构，稍后会被 `mapTrackPlayableStatus` 写入本地字段。
 */
export interface NeteaseTrack {
  id: number;
  name: string;
  ar: NeteaseArtistSummary[];
  /** 一些接口依然返回 `artists` 字段，与 `ar` 含义一致。 */
  artists?: NeteaseArtistSummary[];
  al: NeteaseAlbumSummary;
  /** 歌曲时长（毫秒）。 */
  dt: number;
  /** 与 `privilege.fee` 配合的付费标记。 */
  fee: number;
  privilege?: NeteaseTrackPrivilege;
  noCopyrightRcmd?: NeteaseNoCopyrightRcmd | null;
  /** `mapTrackPlayableStatus` 注入的可播标记。 */
  playable?: boolean;
  /** `mapTrackPlayableStatus` 注入的不可播原因。 */
  reason?: string;
  /** 其余暂未使用的字段。 */
  [key: string]: any;
}

/**
 * `/song/detail` 返回体。
 */
export interface NeteaseSongDetailResponse {
  songs: NeteaseTrack[];
  privileges: NeteaseTrackPrivilege[];
  code: number;
  [key: string]: any;
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
  [key: string]: any;
}

/**
 * 歌词接口 `/lyric` 返回体，同时也是 IndexedDB 的缓存结构。
 */
export interface NeteaseLyricResponse {
  lrc?: { version: number; lyric: string } | null;
  tlyric?: { version: number; lyric: string } | null;
  romalrc?: { version: number; lyric: string } | null;
  yrc?: any; // 原接口会返回逐字歌词，这里暂未解析。
  code: number;
  [key: string]: any;
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
  songs: NeteaseTrack[];
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
export interface NeteasePlaylistDetail {
  id: number;
  name: string;
  description?: string;
  coverImgUrl: string;
  trackCount: number;
  trackIds: NeteasePlaylistTrackRef[];
  tracks: NeteaseTrack[];
  subscribers?: any[]; // 暂只读取数量，未细化结构。
  tags?: string[];
  playCount?: number;
  updateTime?: number;
  createTime?: number;
  creator?: any; // 创建者信息字段较多，暂不展开。
  privileges?: NeteaseTrackPrivilege[];
  [key: string]: any;
}

export interface NeteasePlaylistDetailResponse {
  playlist: NeteasePlaylistDetail;
  privileges?: NeteaseTrackPrivilege[];
  code: number;
  [key: string]: any;
}

/**
 * `/recommend/songs` 返回的每日推荐歌曲列表。
 */
export interface NeteaseDailySongsResponse {
  data: {
    dailySongs: NeteaseTrack[];
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
  data: NeteaseTrack[];
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
  hotSongs: NeteaseTrack[];
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
  simpleSong?: NeteaseTrack;
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
  checkPoint: number;
  code: number;
  [key: string]: any;
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
      songs: NeteaseTrack[];
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
  data: NeteaseTrack[];
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

/**
 * `/top/playlist`、`/top/playlist/highquality` 返回的歌单摘要。
 */
export interface NeteasePlaylistSummary {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  playCount: number;
  description?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * `/user/detail` 返回的用户详情。
 */
export interface NeteaseUserDetailResponse {
  profile: {
    userId: number;
    nickname: string;
    avatarUrl: string;
    backgroundUrl?: string;
    signature?: string;
    vipType?: number;
    [key: string]: any;
  };
  level: number;
  listenSongs: number;
  code: number;
  [key: string]: any;
}

/**
 * `/user/playlist` 返回的歌单集合。
 */
export interface NeteaseUserPlaylistResponse {
  playlist: NeteasePlaylistDetail[] | NeteasePlaylistSummary[];
  code: number;
  more?: boolean;
  [key: string]: any;
}

/**
 * `/user/record` 返回的听歌记录。
 */
export interface NeteaseUserRecordResponse {
  weekData?: Array<{ song: NeteaseTrack; playCount: number; score?: number; [key: string]: any }>;
  allData?: Array<{ song: NeteaseTrack; playCount: number; score?: number; [key: string]: any }>;
  code: number;
  [key: string]: any;
}

/**
 * `/user/account` 返回的账号信息。
 */
export interface NeteaseUserAccountResponse {
  account: {
    id: number;
    userName: string;
    type: number;
    status: number;
    createTime: number;
    vipType: number;
    [key: string]: any;
  };
  profile: NeteaseUserDetailResponse["profile"];
  code: number;
  [key: string]: any;
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
  cookie?: string;
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
    simpleSong?: NeteaseTrack;
    fileName?: string;
    [key: string]: any;
  } | null;
  code: number;
  [key: string]: any;
}
