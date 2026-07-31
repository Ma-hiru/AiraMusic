namespace NeteaseAPI {
  interface NeteasePlaylistDetailResponse extends NeteaseAPIResponse {
    urls?: null;
    fromUsers?: null;
    resEntrance?: null;
    relatedVideos?: null;
    songFromUsers?: null;
    fromUserCount?: number;
    sharedPrivilege?: null;
    playlist: NeteasePlaylistDetail;
    privileges: NeteaseTrackPrivilege[];
  }

  interface NeteaseUserPlaylistResponse extends NeteaseAPIResponse {
    more: boolean;
    playlist: NeteasePlaylistSummary[];
  }

  interface NeteasePlaylistCatlistResponse extends NeteaseAPIResponse {
    all: All;
    sub: Sub[];
    code: number;
    categories: Categories;
  }

  interface NeteaseTopPlaylistResponse extends NeteaseAPIResponse {
    cat: string;
    more: boolean;
    total: number;
    playlists: NeteaseTopPlaylist[];
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
    more: boolean;
    total: number;
    lasttime: number;
    playlists: (NeteaseTopPlaylist & { tag: string; copywriter: string })[];
  }

  interface NeteaseToplistResponse extends NeteaseAPIResponse {
    list: NeteaseToplist[];
    artistToplist?: {
      name: string;
      coverUrl: string;
      position: number;
      upateFrequency: string;
      updateFrequency: string;
    };
  }

  interface NeteaseToplist {
    id: number;
    mix: boolean;
    name: string;
    artists: null;
    creator: null;
    adType: number;
    status: number;
    tags: string[];
    privacy: number;
    ordered: boolean;
    playCount: number;
    topTrackIds: null;
    anonimous: boolean;
    coverImgId: number;
    createTime: number;
    titleImage: number;
    trackCount: number;
    coverImgUrl: string;
    specialType: number;
    highQuality: boolean;
    newImported: boolean;
    opRecommend: boolean;
    playlistType: string;
    promptedMgcInfo: null;
    totalDuration: number;
    algType: null | string;
    subscribers: unknown[];
    cloudTrackCount: number;
    commentThreadId: string;
    coverImgId_str?: string;
    originalCoverId: number;
    subscribedCount: number;
    coverText: null | string;
    backgroundCoverId: number;
    description: null | string;
    subscribed: null | boolean;
    englishTitle: null | string;
    iconImageUrl: null | string;
    coverImageUrl: null | string;
    titleImageUrl: null | string;
    trackNumberUpdateTime: number;
    backgroundCoverUrl: null | string;
    socialPlaylistCover: null | string;
    recommendInfo: null | RecommendInfo;
    /** Current /toplist samples return null; older NCM variants may return preview track pairs. */
    userId: number;
    updateTime: number;
    tsSongCount: number;
    ToplistType?: string;
    uiPlaylistType: string;
    trackUpdateTime: number;
    updateFrequency: string;
    tracks: null | { first: string; second: string }[];
  }

  interface NeteasePlaylistDetail {
    id: number;
    score: null;
    name: string;
    algTags: null;
    adType: number;
    status: number;
    tags: string[];
    copied: boolean;
    privacy: number;
    creator: Creator;
    ordered: boolean;
    remixVideo: null;
    description: null;
    displayTags: null;
    playCount: number;
    sharedUsers: null;
    coverImgId: number;
    createTime: number;
    englishTitle: null;
    shareCount: number;
    titleImage: number;
    trackCount: number;
    coverImgUrl: string;
    coverStatus: number;
    gradeStatus: string;
    relateResType: null;
    specialType: number;
    subscribed: boolean;
    titleImageUrl: null;
    bannedTrackIds: null;
    commentCount: number;
    coverImgId_str: null;
    highQuality: boolean;
    newImported: boolean;
    opRecommend: boolean;
    playlistType: string;
    detailPageTitle: null;
    mvResourceInfos: null;
    subscribers: string[];
    cloudTrackCount: number;
    commentThreadId: string;
    subscribedCount: number;
    backgroundCoverUrl: null;
    distributeTags: string[];
    historySharedUsers: null;
    backgroundCoverId: number;
    podcastTrackCount: number;
    officialPlaylistType: null;
    mixPodcastPlaylist: boolean;
    newDetailPageRemixVideo: null;
    displayUserInfoAsTagOnly: boolean;
    bizExtInfo: { [key: string]: any };
    /**
     * 歌曲ID列表并不一定实际对应tracks数据，存在歌单包含下架歌曲的可能
     * */
    videos: null;
    userId: number;
    videoIds: null;
    trialMode: number;
    updateTime: number;
    trackIds: TrackId[];
    updateFrequency: null;
    tracks: NeteaseTrack[];
    trackUpdateTime: number;
    trackNumberUpdateTime: number;
  }

  interface NeteasePlaylistSummary {
    id: number;
    name: string;
    top: boolean;
    tracks: null;
    artists: null;
    adType: number;
    status: number;
    tags: string[];
    userId: number;
    copied: boolean;
    privacy: number;
    creator: Creator;
    ordered: boolean;
    playCount: number;
    sharedUsers: null;
    shareStatus: null;
    anonimous: boolean;
    coverImgId: number;
    createTime: number;
    titleImage: number;
    trackCount: number;
    updateTime: number;
    coverImgUrl: string;
    specialType: number;
    subscribed: boolean;
    highQuality: boolean;
    newImported: boolean;
    opRecommend: boolean;
    subscribers: string[];
    totalDuration: number;
    cloudTrackCount: number;
    commentThreadId: string;
    containsTracks: boolean;
    subscribedCount: number;
    trackUpdateTime: number;
    backgroundCoverId: number;
    description: null | string;
    englishTitle: null | string;
    titleImageUrl: null | string;
    coverImgId_str: null | string;
    trackNumberUpdateTime: number;
    updateFrequency: null | string;
    backgroundCoverUrl: null | string;
    recommendInfo: null | RecommendInfo;
  }

  interface RecommendInfo {
    alg: string;
    reason: null;
    logInfo: string;
    firstSongId: null;
    relatedId: string;
    relatedType: string;
  }

  interface Creator {
    city: number;
    gender: number;
    userId: number;
    anchor: boolean;
    mutual: boolean;
    vipType: number;
    birthday: number;
    djStatus: number;
    expertTags: null;
    nickname: string;
    province: number;
    remarkName: null;
    userType: number;
    authority: number;
    avatarUrl: string;
    followed: boolean;
    signature: string;
    authStatus: number;
    avatarImgId: number;
    description: string;
    accountStatus: number;
    backgroundUrl: string;
    avatarImgIdStr: string;
    defaultAvatar: boolean;
    avatarImgId_str: string;
    backgroundImgId: number;
    experts: null | Experts;
    detailDescription: string;
    backgroundImgIdStr: string;
    authenticationTypes: number;
    avatarDetail: null | AvatarDetail;
  }

  interface AvatarDetail {
    userType: number;
    identityLevel: number;
    identityIconUrl: string;
  }

  interface Experts {
    "1": string;
    "2": string;
  }

  interface TrackId {
    f: null;
    sc: null;
    sr: null;
    alg: null;
    dpr: null;
    t: number;
    v: number;
    at: number;
    id: number;
    tr: number;
    uid: number;
    rcmdReason: string;
    rcmdReasonTitle: string;
  }

  interface All {
    hot: boolean;
    imgUrl: null;
    name: string;
    type: number;
    imgId: number;
    category: number;
    activity: boolean;
    resourceType: number;
    resourceCount: number;
  }

  interface Categories {
    "0": string;
    "1": string;
    "2": string;
    "3": string;
    "4": string;
  }

  interface Sub {
    hot: boolean;
    imgUrl: null;
    name: string;
    type: number;
    imgId: number;
    category: number;
    activity: boolean;
    resourceType: number;
    resourceCount: number;
  }

  interface NeteaseTopPlaylist {
    id: number;
    alg: string;
    title: null;
    name: string;
    tracks: null;
    algType: null;
    adType: number;
    status: number;
    subTitle: null;
    tags: string[];
    userId: number;
    coverText: null;
    privacy: number;
    creator: Creator;
    iconImgUrl: null;
    ordered: boolean;
    playCount: number;
    relateResId: null;
    topTrackIds: null;
    anonimous: boolean;
    coverImgId: number;
    createTime: number;
    shareCount: number;
    trackCount: number;
    updateTime: number;
    coverImgUrl: string;
    coverStatus: number;
    description: string;
    recommendInfo: null;
    recommendText: null;
    relateResType: null;
    specialType: number;
    subscribed: boolean;
    tsSongCount: number;
    backgroundText: null;
    commentCount: number;
    highQuality: boolean;
    newImported: boolean;
    playlistType: string;
    totalDuration: number;
    coverImgId_str: string;
    uiPlaylistType: string;
    cloudTrackCount: number;
    commentThreadId: string;
    originalCoverId: number;
    subscribedCount: number;
    trackUpdateTime: number;
    backgroundImageUrl: null;
    backgroundImageId: number;
    socialPlaylistCover: null;
    subscribers: Subscriber[];
    trackNumberUpdateTime: number;
  }

  interface Subscriber {
    city: number;
    experts: null;
    gender: number;
    userId: number;
    anchor: boolean;
    mutual: boolean;
    vipType: number;
    birthday: number;
    djStatus: number;
    expertTags: null;
    nickname: string;
    province: number;
    remarkName: null;
    userType: number;
    authority: number;
    avatarUrl: string;
    followed: boolean;
    signature: string;
    authStatus: number;
    avatarDetail: null;
    avatarImgId: number;
    description: string;
    accountStatus: number;
    backgroundUrl: string;
    avatarImgIdStr: string;
    defaultAvatar: boolean;
    backgroundImgId: number;
    detailDescription: string;
    backgroundImgIdStr: string;
    authenticationTypes: number;
  }

  interface RecommendPlaylistResult {
    id: number;
    alg: string;
    name: string;
    type: number;
    picUrl: string;
    playCount: number;
    copywriter: string;
    trackCount: number;
    highQuality: boolean;
    trackNumberUpdateTime: number;
    canDislike: boolean;
  }

  interface DailyRecommendPlaylistResult {
    id: number;
    alg: string;
    name: string;
    type: number;
    picUrl: string;
    userId: number;
    creator: Creator;
    playcount: number;
    copywriter: string;
    createTime: number;
    trackCount: number;
  }

  interface NeteasePlaylistIntelligenceResponse extends NeteaseAPIResponse {
    data: {
      id: number;
      alg: string;
      recommended: boolean;
      songInfo: {
        h: H;
        l: L;
        m: M;
        al: Al;
        a: null;
        ar: Ar[];
        t: number;
        v: number;
        cd: string;
        cf: string;
        cp: number;
        crbt: null;
        dt: number;
        id: number;
        mv: number;
        no: number;
        rurl: null;
        st: number;
        fee: number;
        mst: number;
        pop: number;
        pst: number;
        rtUrl: null;
        djId: number;
        name: string;
        s_id: number;
        ftype: number;
        rtype: number;
        alia: string[];
        tns?: string[];
        rtUrls: string[];
        copyright: number;
        rt: null | string;
        publishTime: number;
        privilege: Privilege;
      };
    }[];
  }
}
