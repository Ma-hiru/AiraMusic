namespace NeteaseAPI {
  /**
   * 嵌入在歌曲数据中的歌手简介。
   */
  interface Ar {
    alias: string[];
    id: number;
    name: string;
    tns: string[];
  }

  interface NeteaseArtistHotTracksResponse extends NeteaseAPIResponse {
    more: boolean;
    songs: ArtistHotSong[];
  }

  interface ArtistHotSong {
    a: null;
    additionalTitle: null | string;
    al: Al;
    alia: string[];
    ar: Ar[];
    artistClassics: boolean;
    awardName: string;
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
    hr: null;
    id: number;
    l: L;
    m: M;
    mainTitle: null | string;
    mark: number;
    markTags: string[];
    mst: number;
    mv: number;
    name: string;
    no: number;
    noCopyrightRcmd: null;
    originCoverType: number;
    originSongSimpleData: null | OriginSongSimpleData;
    pop: number;
    privilege: {
      bd: null;
      chargeInfoList: ChargeInfoList[];
      code: number;
      cp: number;
      cs: boolean;
      dl: number;
      dlLevel: string;
      dlLevels: null;
      downloadMaxbr: number;
      downloadMaxBrLevel: string;
      fee: number;
      fl: number;
      flag: number;
      flLevel: string;
      freeTrialPrivilege: {
        cannotListenReason: number | null;
        freeLimitTagType: null;
        listenType: null;
        playReason: null;
        resConsumable: boolean;
        userConsumable: boolean;
      };
      id: number;
      ignoreCache: null;
      maxbr: number;
      maxBrLevel: string;
      message: null;
      payed: number;
      pl: number;
      playMaxbr: number;
      playMaxBrLevel: string;
      plLevel: string;
      plLevels: null;
      preSell: boolean;
      rightSource: number;
      rscl: null;
      sp: number;
      st: number;
      subp: number;
      toast: boolean;
    };
    pst: number;
    publishTime: number;
    resourceState: boolean;
    rt: null | string;
    rtUrl: null;
    rtUrls: string[];
    rtype: number;
    rurl: null;
    s_id: number;
    single: number;
    songFeature: null;
    songJumpInfo: null;
    sq: Sq;
    st: number;
    t: number;
    tagPicList: null;
    v: number;
    version: number;
  }

  interface OriginSongSimpleData {
    albumMeta: { id: number; name: string };
    artists: { id: number; name: string }[];
    name: string;
    songId: number;
  }

  interface NeteaseArtistDetailResponse extends NeteaseAPIResponse {
    data: ArtistDetail;
  }

  interface ArtistDetail {
    artist: {
      albumSize: number;
      alias: string[];
      avatar: string;
      briefDesc: string;
      cover: string;
      id: number;
      identifyTag: null;
      identities: string[];
      musicSize: number;
      mvSize: number;
      name: string;
      rank: {
        rank: number;
        type: number;
      };
      transNames: string[];
    };
    blacklist: boolean;
    identify: {
      actionUrl: string;
      imageDesc: string;
      imageUrl: null;
    };
    preferShow: number;
    secondaryExpertIdentiy: {
      expertIdentiyCount: number;
      expertIdentiyId: number;
      expertIdentiyName: string;
    }[];
    showPriMsg: boolean;
    videoCount: number;
  }

  interface NeteaseArtistDescResponse extends NeteaseAPIResponse {
    /** 简要介绍 */
    briefDesc: string;
    count: number;
    introduction: {
      /** 介绍文本的标题 */
      ti: string;
      /** 介绍文本的内容 */
      txt: string;
    }[];
    topicData: TopicDatum[];
  }

  interface TopicDatum {
    addTime: number;
    categoryId: number;
    categoryName: string;
    commentCount: number;
    commentThreadId: string;
    coverUrl: string;
    creator: {
      accountStatus: number;
      accountType: number;
      anchor: boolean;
      authenticated: boolean;
      authenticationTypes: number;
      authority: number;
      authStatus: number;
      avatarDetail: null;
      avatarImgId: number;
      avatarUrl: string;
      backgroundImgId: number;
      backgroundUrl: string;
      birthday: number;
      city: number;
      createTime: number;
      defaultAvatar: boolean;
      description: null | string;
      detailDescription: null | string;
      djStatus: number;
      experts: null | { "1": string };
      expertTags: string[] | null;
      followed: boolean;
      gender: number;
      lastLoginIP: string;
      lastLoginTime: number;
      locationStatus: number;
      mutual: boolean;
      nickname: string;
      province: number;
      remarkName: null;
      shortUserName: string;
      signature: string;
      userId: number;
      userName: string;
      userType: number;
      vipType: number;
      viptypeVersion: number;
    };
    id: number;
    liked: boolean;
    likedCount: number;
    mainTitle: string;
    memo: null;
    number: number;
    readCount: number;
    recmdContent: string;
    recmdTitle: string;
    rectanglePicUrl: string;
    relatedResource: null;
    reward: boolean;
    rewardCount: number;
    rewardMoney: number;
    seriesId: number;
    shareContent: string;
    shareCount: number;
    showComment: boolean;
    showRelated: boolean;
    summary: string;
    tags: string[];
    title: string;
    topic: {
      addTime: number;
      adInfo: string;
      auditor: string;
      auditStatus: number;
      auditTime: number;
      categoryId: number;
      content: { content: null | string; id: number; type: number }[];
      cover: number;
      delReason: string;
      fromBackend: boolean;
      headPic: number;
      hotScore: number;
      id: number;
      mainTitle: string;
      memo: null;
      number: number;
      pubImmidiatly: boolean;
      pubTime: number;
      readCount: number;
      recomdContent: string;
      recomdTitle: string;
      rectanglePic: number;
      reward: boolean;
      seriesId: number;
      shareContent: string;
      showComment: boolean;
      showRelated: boolean;
      startText: string;
      status: number;
      summary: string;
      tags: string[];
      title: string;
      updateTime: number;
      userId: number;
      wxTitle: string;
    };
    url: string;
    wxTitle: string;
  }

  interface NeteaseArtistFollowCountResponse extends NeteaseAPIResponse {
    data: {
      isFollow: boolean;
      fansCnt: number;
      followCnt: number;
      followDay: string;
      followDayCnt: number;
      follow: boolean;
    };
  }

  interface NeteaseArtistToplistResponse extends NeteaseAPIResponse {
    list: {
      artists: ToplistArtist[];
      type: number;
      updateTime: number;
    };
  }

  interface ToplistArtist {
    albumSize: number;
    alias: string[];
    briefDesc: string;
    id: number;
    img1v1Id: number;
    img1v1Id_str?: string;
    img1v1Url: string;
    lastRank: number;
    musicSize: number;
    name: string;
    picId: number;
    picId_str?: string;
    picUrl: string;
    score: number;
    topicPerson: number;
    trans: string;
    transNames?: string[];
  }

  interface NeteaseArtistAlbumResponse extends NeteaseAPIResponse {
    artist: {
      albumSize: number;
      alias: string[];
      briefDesc: string;
      followed: boolean;
      id: number;
      img1v1Id: number;
      img1v1Id_str: string;
      img1v1Url: string;
      musicSize: number;
      name: string;
      picId: number;
      picId_str: string;
      picUrl: string;
      topicPerson: number;
      trans: string;
    };
    hotAlbums: ArtistAlbum[];
    kindTabs: null;
    more: boolean;
  }

  interface ArtistAlbum {
    alias: string[];
    artist: {
      albumSize: number;
      alias: string[];
      briefDesc: string;
      followed: boolean;
      id: number;
      img1v1Id: number;
      img1v1Id_str: string;
      img1v1Url: string;
      musicSize: number;
      name: string;
      picId: number;
      picId_str: string;
      picUrl: string;
      topicPerson: number;
      trans: string;
    };
    artists: {
      albumSize: number;
      alias: string[];
      briefDesc: string;
      followed: boolean;
      id: number;
      img1v1Id: number;
      img1v1Id_str: string;
      img1v1Url: string;
      musicSize: number;
      name: string;
      picId: number;
      picUrl: string;
      topicPerson: number;
      trans: string;
    }[];
    awardTags: null;
    blurPicUrl: string;
    briefDesc: string;
    commentThreadId: string;
    company: string;
    companyId: number;
    copyrightId: number;
    description: string;
    displayTags: null;
    id: number;
    mark: number;
    name: string;
    onSale: boolean;
    paid: boolean;
    pic: number;
    picId: number;
    picId_str: string;
    picUrl: string;
    publishTime: number;
    size: number;
    songs: unknown[];
    status: number;
    subType: string;
    tags: string;
    type: string;
  }
}
