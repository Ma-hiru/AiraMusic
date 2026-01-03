interface NeteasePlaylistDetailResponse extends NeteaseAPIResponse {
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

interface NeteaseUserPlaylistResponse extends NeteaseAPIResponse {
  playlist: NeteasePlaylistSummary[];
  more: boolean;
}

interface NeteasePlaylistCatlistResponse extends NeteaseAPIResponse {
  all: All;
  categories: Categories;
  code: number;
  sub: Sub[];
}

interface NeteaseTopPlaylistResponse extends NeteaseAPIResponse {
  cat: string;
  more: boolean;
  playlists: NeteaseTopPlaylist[];
  total: number;
}

interface NeteaseRecommendPlaylistResponse extends NeteaseAPIResponse {
  category: number;
  hasTaste: boolean;
  result: RecommendPlaylistResult[];
}

interface NeteaseDailyRecommendPlaylistResponse extends NeteaseAPIResponse {
  featureFirst: boolean;
  haveRcmdSongs: boolean;
  recommend: DailyRecommendPlaylistResult[];
}

interface NeteaseHighQualityPlaylistsResponse extends NeteaseAPIResponse {
  lasttime: number;
  more: boolean;
  playlists: (NeteaseTopPlaylist & { copywriter: string; tag: string })[];
  total: number;
}

interface NeteasePlaylistDetail {
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

interface NeteasePlaylistSummary {
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

interface RecommendInfo {
  alg: string;
  firstSongId: null;
  logInfo: string;
  reason: null;
  relatedId: string;
  relatedType: string;
}

interface Creator {
  accountStatus: number;
  anchor: boolean;
  authenticationTypes: number;
  authority: number;
  authStatus: number;
  avatarDetail: AvatarDetail | null;
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
  experts: null | Experts;
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

interface AvatarDetail {
  identityIconUrl: string;
  identityLevel: number;
  userType: number;
}

interface Experts {
  "1": string;
  "2": string;
}

interface TrackId {
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

interface All {
  activity: boolean;
  category: number;
  hot: boolean;
  imgId: number;
  imgUrl: null;
  name: string;
  resourceCount: number;
  resourceType: number;
  type: number;
}

interface Categories {
  "0": string;
  "1": string;
  "2": string;
  "3": string;
  "4": string;
}

interface Sub {
  activity: boolean;
  category: number;
  hot: boolean;
  imgId: number;
  imgUrl: null;
  name: string;
  resourceCount: number;
  resourceType: number;
  type: number;
}

interface NeteaseTopPlaylist {
  adType: number;
  alg: string;
  algType: null;
  anonimous: boolean;
  backgroundImageId: number;
  backgroundImageUrl: null;
  backgroundText: null;
  cloudTrackCount: number;
  commentCount: number;
  commentThreadId: string;
  coverImgId: number;
  coverImgId_str: string;
  coverImgUrl: string;
  coverStatus: number;
  coverText: null;
  createTime: number;
  creator: Creator;
  description: string;
  highQuality: boolean;
  iconImgUrl: null;
  id: number;
  name: string;
  newImported: boolean;
  ordered: boolean;
  originalCoverId: number;
  playCount: number;
  playlistType: string;
  privacy: number;
  recommendInfo: null;
  recommendText: null;
  relateResId: null;
  relateResType: null;
  shareCount: number;
  socialPlaylistCover: null;
  specialType: number;
  status: number;
  subscribed: boolean;
  subscribedCount: number;
  subscribers: Subscriber[];
  subTitle: null;
  tags: string[];
  title: null;
  topTrackIds: null;
  totalDuration: number;
  trackCount: number;
  trackNumberUpdateTime: number;
  tracks: null;
  trackUpdateTime: number;
  tsSongCount: number;
  uiPlaylistType: string;
  updateTime: number;
  userId: number;
}

interface Subscriber {
  accountStatus: number;
  anchor: boolean;
  authenticationTypes: number;
  authority: number;
  authStatus: number;
  avatarDetail: null;
  avatarImgId: number;
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

interface RecommendPlaylistResult {
  alg: string;
  canDislike: boolean;
  copywriter: string;
  highQuality: boolean;
  id: number;
  name: string;
  picUrl: string;
  playCount: number;
  trackCount: number;
  trackNumberUpdateTime: number;
  type: number;
}

interface DailyRecommendPlaylistResult {
  alg: string;
  copywriter: string;
  createTime: number;
  creator: Creator;
  id: number;
  name: string;
  picUrl: string;
  playcount: number;
  trackCount: number;
  type: number;
  userId: number;
}
