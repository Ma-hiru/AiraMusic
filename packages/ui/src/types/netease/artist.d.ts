namespace NeteaseAPI {
  /**
   * 嵌入在歌曲数据中的歌手简介。
   */
  interface Ar {
    id: number;
    name: string;
    tns: string[];
    alias: string[];
  }

  interface NeteaseArtistHotTracksResponse extends NeteaseAPIResponse {
    more: boolean;
    songs: ArtistHotSong[];
  }

  interface ArtistHotSong {
    h: H;
    l: L;
    m: M;
    al: Al;
    sq: Sq;
    a: null;
    ar: Ar[];
    hr: null;
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
    mark: number;
    name: string;
    s_id: number;
    ftype: number;
    rtype: number;
    alia: string[];
    single: number;
    awardTags: null;
    version: number;
    rtUrls: string[];
    tagPicList: null;
    awardName: string;
    copyright: number;
    displayTags: null;
    rt: null | string;
    songFeature: null;
    markTags: string[];
    songJumpInfo: null;
    publishTime: number;
    noCopyrightRcmd: null;
    resourceState: boolean;
    artistClassics: boolean;
    entertainmentTags: null;
    originCoverType: number;
    mainTitle: null | string;
    additionalTitle: null | string;
    originSongSimpleData: null | OriginSongSimpleData;
    privilege: {
      bd: null;
      cp: number;
      dl: number;
      fl: number;
      id: number;
      pl: number;
      rscl: null;
      sp: number;
      st: number;
      cs: boolean;
      fee: number;
      code: number;
      flag: number;
      subp: number;
      maxbr: number;
      message: null;
      payed: number;
      dlLevels: null;
      plLevels: null;
      toast: boolean;
      dlLevel: string;
      flLevel: string;
      plLevel: string;
      preSell: boolean;
      ignoreCache: null;
      playMaxbr: number;
      maxBrLevel: string;
      rightSource: number;
      downloadMaxbr: number;
      playMaxBrLevel: string;
      downloadMaxBrLevel: string;
      chargeInfoList: ChargeInfoList[];
      freeTrialPrivilege: {
        listenType: null;
        playReason: null;
        freeLimitTagType: null;
        resConsumable: boolean;
        userConsumable: boolean;
        cannotListenReason: null | number;
      };
    };
  }

  interface OriginSongSimpleData {
    name: string;
    songId: number;
    albumMeta: { id: number; name: string };
    artists: { id: number; name: string }[];
  }

  interface NeteaseArtistDetailResponse extends NeteaseAPIResponse {
    data: ArtistDetail;
  }

  interface ArtistDetail {
    blacklist: boolean;
    preferShow: number;
    videoCount: number;
    showPriMsg: boolean;
    identify: {
      imageUrl: null;
      actionUrl: string;
      imageDesc: string;
    };
    secondaryExpertIdentiy: {
      expertIdentiyId: number;
      expertIdentiyName: string;
      expertIdentiyCount: number;
    }[];
    artist: {
      id: number;
      name: string;
      cover: string;
      avatar: string;
      mvSize: number;
      alias: string[];
      albumSize: number;
      briefDesc: string;
      identifyTag: null;
      musicSize: number;
      identities: string[];
      transNames: string[];
      rank: {
        rank: number;
        type: number;
      };
    };
  }

  interface NeteaseArtistDescResponse extends NeteaseAPIResponse {
    /** 简要介绍 */
    count: number;
    briefDesc: string;
    topicData: TopicDatum[];
    introduction: {
      /** 介绍文本的标题 */
      ti: string;
      /** 介绍文本的内容 */
      txt: string;
    }[];
  }

  interface TopicDatum {
    id: number;
    memo: null;
    url: string;
    title: string;
    liked: boolean;
    number: number;
    tags: string[];
    reward: boolean;
    summary: string;
    wxTitle: string;
    coverUrl: string;
    seriesId: number;
    mainTitle: string;
    readCount: number;
    categoryId: number;
    likedCount: number;
    recmdTitle: string;
    shareCount: number;
    rewardCount: number;
    rewardMoney: number;
    categoryName: string;
    commentCount: number;
    recmdContent: string;
    shareContent: string;
    showComment: boolean;
    showRelated: boolean;
    relatedResource: null;
    commentThreadId: string;
    rectanglePicUrl: string;
    topic: {
      id: number;
      memo: null;
      cover: number;
      title: string;
      adInfo: string;
      number: number;
      status: number;
      tags: string[];
      userId: number;
      addTime: number;
      auditor: string;
      headPic: number;
      pubTime: number;
      reward: boolean;
      summary: string;
      wxTitle: string;
      hotScore: number;
      seriesId: number;
      auditTime: number;
      delReason: string;
      mainTitle: string;
      readCount: number;
      startText: string;
      categoryId: number;
      updateTime: number;
      auditStatus: number;
      recomdTitle: string;
      fromBackend: boolean;
      rectanglePic: number;
      shareContent: string;
      showComment: boolean;
      showRelated: boolean;
      recomdContent: string;
      pubImmidiatly: boolean;
      content: { id: number; type: number; content: null | string }[];
    };
    creator: {
      city: number;
      gender: number;
      userId: number;
      anchor: boolean;
      mutual: boolean;
      vipType: number;
      birthday: number;
      djStatus: number;
      nickname: string;
      province: number;
      remarkName: null;
      userName: string;
      userType: number;
      authority: number;
      avatarUrl: string;
      followed: boolean;
      signature: string;
      authStatus: number;
      avatarDetail: null;
      createTime: number;
      accountType: number;
      avatarImgId: number;
      lastLoginIP: string;
      accountStatus: number;
      backgroundUrl: string;
      lastLoginTime: number;
      shortUserName: string;
      authenticated: boolean;
      defaultAvatar: boolean;
      locationStatus: number;
      viptypeVersion: number;
      backgroundImgId: number;
      description: null | string;
      authenticationTypes: number;
      expertTags: null | string[];
      experts: null | { "1": string };
      detailDescription: null | string;
    };
    addTime: number;
  }

  interface NeteaseArtistFollowCountResponse extends NeteaseAPIResponse {
    data: {
      fansCnt: number;
      follow: boolean;
      followCnt: number;
      followDay: string;
      isFollow: boolean;
      followDayCnt: number;
    };
  }

  interface NeteaseArtistToplistResponse extends NeteaseAPIResponse {
    list: {
      type: number;
      updateTime: number;
      artists: ToplistArtist[];
    };
  }

  interface ToplistArtist {
    id: number;
    name: string;
    picId: number;
    score: number;
    trans: string;
    picUrl: string;
    alias: string[];
    img1v1Id: number;
    lastRank: number;
    albumSize: number;
    briefDesc: string;
    img1v1Url: string;
    musicSize: number;
    picId_str?: string;
    topicPerson: number;
    img1v1Id_str?: string;
    transNames?: string[];
  }

  interface NeteaseArtistAlbumResponse extends NeteaseAPIResponse {
    more: boolean;
    kindTabs: null;
    hotAlbums: ArtistAlbum[];
    artist: {
      id: number;
      name: string;
      picId: number;
      trans: string;
      picUrl: string;
      alias: string[];
      img1v1Id: number;
      albumSize: number;
      briefDesc: string;
      followed: boolean;
      img1v1Url: string;
      musicSize: number;
      picId_str: string;
      topicPerson: number;
      img1v1Id_str: string;
    };
  }

  interface ArtistAlbum {
    id: number;
    pic: number;
    mark: number;
    name: string;
    size: number;
    tags: string;
    type: string;
    paid: boolean;
    picId: number;
    picUrl: string;
    status: number;
    alias: string[];
    awardTags: null;
    company: string;
    subType: string;
    songs: unknown[];
    briefDesc: string;
    companyId: number;
    displayTags: null;
    picId_str: string;
    blurPicUrl: string;
    copyrightId: number;
    description: string;
    publishTime: number;
    commentThreadId: string;
    artists: {
      id: number;
      name: string;
      picId: number;
      trans: string;
      picUrl: string;
      alias: string[];
      img1v1Id: number;
      albumSize: number;
      briefDesc: string;
      followed: boolean;
      img1v1Url: string;
      musicSize: number;
      topicPerson: number;
      img1v1Id_str: string;
    }[];
    artist: {
      id: number;
      name: string;
      picId: number;
      trans: string;
      picUrl: string;
      alias: string[];
      img1v1Id: number;
      albumSize: number;
      briefDesc: string;
      followed: boolean;
      img1v1Url: string;
      musicSize: number;
      picId_str: string;
      topicPerson: number;
      img1v1Id_str: string;
    };
    onSale: boolean;
  }
}
