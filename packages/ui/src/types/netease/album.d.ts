namespace NeteaseAPI {
  /**
   * 嵌入在歌曲数据中的专辑简介。
   */
  interface Al {
    id: number;
    pic: number;
    name: string;
    tns: string[];
    picUrl: string;
  }

  interface NeteaseAlbumDynamicDetailResponse extends NeteaseAPIResponse {
    isSub: boolean;
    subTime: number;
    subCount: number;
    likedCount: number;
    shareCount: number;
    albumGameInfo: null;
    commentCount: number;
    onSale: boolean;
  }

  interface NeteaseAlbumContentResponse extends NeteaseAPIResponse {
    songs: AlbumSong[];
    resourceState: boolean;
    album: NeteaseAlbumContent;
  }

  interface NeteaseNewAlbumsResponse extends NeteaseAPIResponse {
    total: number;
    albums: ArtistAlbum[];
  }

  interface NeteaseAlbumContent {
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
    songs: string[];
    subType: string;
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
    info: {
      comments: null;
      liked: boolean;
      threadId: string;
      likedCount: number;
      resourceId: number;
      shareCount: number;
      commentCount: number;
      resourceType: number;
      latestLikedUsers: null;
      commentThread: {
        id: string;
        hotCount: number;
        likedCount: number;
        resourceId: number;
        shareCount: number;
        commentCount: number;
        resourceType: number;
        resourceTitle: string;
        latestLikedUsers: null;
        resourceOwnerId: number;
        resourceInfo: {
          id: number;
          name: string;
          webUrl: null;
          creator: null;
          imgUrl: string;
          subTitle: null;
          userId: number;
          encodedId: null;
        };
      };
    };
    onSale: boolean;
  }

  interface AlbumSong {
    h: H;
    l: L;
    m: M;
    al: Al;
    sq: Sq;
    a: null;
    ar: Ar[];
    hr: null;
    rt: null;
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
    ftype: number;
    rtype: number;
    alia: string[];
    tns?: string[];
    rtUrls: string[];
    songJumpInfo: null;
    artistClassics: null;
    noCopyrightRcmd: null;
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
      freeTrialPrivilege: FreeTrialPrivilege;
    };
  }
}
