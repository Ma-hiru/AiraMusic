namespace NeteaseAPI {
  /**
   * 嵌入在歌曲数据中的专辑简介。
   */
  interface Al {
    id: number;
    name: string;
    pic: number;
    picUrl: string;
    tns: string[];
  }

  interface NeteaseAlbumDynamicDetailResponse extends NeteaseAPIResponse {
    albumGameInfo: null;
    commentCount: number;
    isSub: boolean;
    likedCount: number;
    onSale: boolean;
    shareCount: number;
    subCount: number;
    subTime: number;
  }

  interface NeteaseAlbumContentResponse extends NeteaseAPIResponse {
    album: NeteaseAlbumContent;
    resourceState: boolean;
    songs: Song[];
  }

  interface NeteaseAlbumContent {
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
    info: {
      commentCount: number;
      comments: null;
      commentThread: {
        commentCount: number;
        hotCount: number;
        id: string;
        latestLikedUsers: null;
        likedCount: number;
        resourceId: number;
        resourceInfo: {
          creator: null;
          encodedId: null;
          id: number;
          imgUrl: string;
          name: string;
          subTitle: null;
          userId: number;
          webUrl: null;
        };
        resourceOwnerId: number;
        resourceTitle: string;
        resourceType: number;
        shareCount: number;
      };
      latestLikedUsers: null;
      liked: boolean;
      likedCount: number;
      resourceId: number;
      resourceType: number;
      shareCount: number;
      threadId: string;
    };
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
    songs: string[];
    status: number;
    subType: string;
    tags: string;
    type: string;
  }

  interface Song {
    a: null;
    al: Al;
    alia: string[];
    ar: Ar[];
    artistClassics: null;
    cd: string;
    cf: string;
    cp: number;
    crbt: null;
    djId: number;
    dt: number;
    fee: number;
    ftype: number;
    h: H;
    hr: null;
    id: number;
    l: L;
    m: M;
    mst: number;
    mv: number;
    name: string;
    no: number;
    noCopyrightRcmd: null;
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
      freeTrialPrivilege: FreeTrialPrivilege;
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
    rt: null;
    rtUrl: null;
    rtUrls: string[];
    rtype: number;
    rurl: null;
    songJumpInfo: null;
    sq: Sq;
    st: number;
    t: number;
    tns?: string[];
    v: number;
  }
}
