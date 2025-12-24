interface NeteaseSearchDefaultKeywordsResponse extends NeteaseAPIResponse {
  data: NeteaseSearchDefaultKeywords;
  message: null;
}

interface NeteaseSearchDefaultKeywords {
  action: number;
  alg: string;
  bizQueryInfo: string;
  gap: number;
  imageUrl: null;
  logInfo: null;
  realkeyword: string;
  searchType: number;
  showKeyword: string;
  source: null;
  styleKeyword: {
    descWord: null;
    keyWord: string;
  };
  trp_id: null;
  trp_type: null;
}

interface NeteaseSearchHotListDetailResponse extends NeteaseAPIResponse {
  data: NeteaseSearchHotListDetail[];
  message: string;
  trp: { rules: string[] };
}

interface NeteaseSearchHotListDetail {
  alg: string;
  content: string;
  iconType: number;
  iconUrl: string;
  score: number;
  searchWord: string;
  source: number;
  url: string;
}

interface NeteaseSearchSongResult {
  hasMore: boolean;
  songCount: number;
  songs: {
    album: {
      alia?: string[];
      artist: {
        albumSize: number;
        alias: string[];
        appendRecText: null;
        fansGroup: null;
        fansSize: null;
        id: number;
        img1v1: number;
        img1v1Url: string;
        musicSize: number;
        name: string;
        picId: number;
        picUrl: null;
        recommendText: null;
        trans: null;
      };
      copyrightId: number;
      id: number;
      mark: number;
      name: string;
      picId: number;
      publishTime: number;
      size: number;
      status: number;
      transNames?: string[];
    };
    alias: string[];
    artists: {
      albumSize: number;
      alias: string[];
      appendRecText: null;
      fansGroup: null;
      fansSize: null;
      id: number;
      img1v1: number;
      img1v1Url: string;
      musicSize: number;
      name: string;
      picId: number;
      picUrl: null;
      recommendText: null;
      trans: null;
    }[];
    copyrightId: number;
    duration: number;
    fee: number;
    ftype: number;
    id: number;
    mark: number;
    mvid: number;
    name: string;
    rtype: number;
    rUrl: null;
    status: number;
    transNames: string[];
  }[];
}

interface NeteaseSearchPlaylistResult {
  hasMore: boolean;
  hlWords: string[];
  playlistCount: number;
  playlists: {
    action: string;
    actionType: string;
    alg: string;
    bookCount: number;
    coverImgUrl: string;
    creator: {
      authStatus: number;
      avatarUrl: string;
      experts: null;
      expertTags: null;
      nickname: string;
      userId: number;
      userType: number;
    };
    description: null | string;
    highQuality: boolean;
    id: number;
    name: string;
    officialPlaylistTitle: null | string;
    officialTags: string[] | null;
    playCount: number;
    playlistType: string;
    recommendText: string;
    score: null;
    specialType: number;
    subscribed: boolean;
    trackCount: number;
    userId: number;
  }[];
  searchQcReminder: null;
}

interface NeteaseSearchAlbumResult {
  albumCount: number;
  albums: {
    alg: string;
    alias: string[];
    artist: {
      albumSize: number;
      alia: string[];
      alias: string[];
      briefDesc: string;
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
    blurPicUrl: string;
    briefDesc: string;
    commentThreadId: string;
    company: null | string;
    companyId: number;
    containedSong: string;
    copyrightId: number;
    description: string;
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
    songs: null;
    status: number;
    tags: string;
    transNames: string[];
    type: string;
  }[];
  hlWords: string[];
}

interface NeteaseSearchArtistResult {
  artistCount: number;
  artists: {
    accountId: number;
    albumSize: number;
    alg: string;
    alia: string[];
    alias: string[];
    appendRecText: string;
    fansGroup: null;
    fansSize: number;
    followed: boolean;
    id: number;
    identityIconUrl: string;
    img1v1: number;
    img1v1Url: string;
    musicSize: number;
    mvSize: number;
    name: string;
    picId: number;
    picUrl: null | string;
    recommendText: string;
    trans: null;
  }[];
  hasMore: boolean;
  hlWords: string[];
  searchQcReminder: null;
}

interface NeteaseSearchAllResult {
  album: {
    albums: {
      alg: string;
      alias: string[];
      artist: {
        albumSize: number;
        alia: string[];
        alias: string[];
        briefDesc: string;
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
      blurPicUrl: string;
      briefDesc: string;
      commentThreadId: string;
      company: string;
      companyId: number;
      copyrightId: number;
      description: string;
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
      status: number;
      tags: string;
      type: string;
    }[];
    more: boolean;
    moreText: string;
    resourceIds: number[];
  };
  artist: {
    artists: {
      accountId: number;
      albumSize: number;
      alg: string;
      alia: string[];
      alias: string[];
      fansSize: number;
      followed: boolean;
      id: number;
      identityIconUrl: string;
      img1v1: number;
      img1v1Url: string;
      musicSize: number;
      mvSize: number;
      name: string;
      picId: number;
      picUrl: string;
    }[];
    more: boolean;
    moreText: string;
    resourceIds: number[];
  };
  code: number;
  new_mlog: { more: boolean; resources: string[] };
  order: string[];
  playList: {
    more: boolean;
    moreText: string;
    playLists: {
      alg: string;
      bookCount: number;
      coverImgUrl: string;
      creator: {
        authStatus: number;
        avatarUrl: string;
        nickname: string;
        userId: number;
        userType: number;
      };
      description: string;
      highQuality: boolean;
      id: number;
      name: string;
      officialTags: string[];
      playCount: number;
      playlistType: string;
      specialType: number;
      subscribed: boolean;
      track: {
        album: {
          alias: string[];
          artist: {
            albumSize: number;
            alias: string[];
            briefDesc: string;
            id: number;
            img1v1Id: number;
            img1v1Url: string;
            musicSize: number;
            name: string;
            picId: number;
            picUrl: string;
            topicPerson: number;
            trans: string;
          };
          artists: {
            albumSize: number;
            alias: string[];
            briefDesc: string;
            id: number;
            img1v1Id: number;
            img1v1Url: string;
            musicSize: number;
            name: string;
            picId: number;
            picUrl: string;
            topicPerson: number;
            trans: string;
          }[];
          blurPicUrl: string;
          briefDesc: string;
          commentThreadId: string;
          company: string;
          companyId: number;
          copyrightId: number;
          description: string;
          gapless: number;
          id: number;
          mark: number;
          name: string;
          onSale: boolean;
          pic: number;
          picId: number;
          picId_str: string;
          picUrl: string;
          publishTime: number;
          size: number;
          songs: string[];
          status: number;
          tags: string;
          type: string;
        };
        alias: string[];
        artists: {
          albumSize: number;
          alias: string[];
          briefDesc: string;
          id: number;
          img1v1Id: number;
          img1v1Url: string;
          musicSize: number;
          name: string;
          picId: number;
          picUrl: string;
          topicPerson: number;
          trans: string;
        }[];
        bMusic: {
          bitrate: number;
          dfsId: number;
          extension: string;
          id: number;
          playTime: number;
          size: number;
          sr: number;
          volumeDelta: number;
        };
        commentThreadId: string;
        copyFrom: string;
        copyright: number;
        copyrightId: number;
        dayPlays: number;
        disc: string;
        duration: number;
        fee: number;
        ftype: number;
        hearTime: number;
        hMusic: {
          bitrate: number;
          dfsId: number;
          extension: string;
          id: number;
          playTime: number;
          size: number;
          sr: number;
          volumeDelta: number;
        };
        id: number;
        lMusic: {
          bitrate: number;
          dfsId: number;
          extension: string;
          id: number;
          playTime: number;
          size: number;
          sr: number;
          volumeDelta: number;
        };
        mMusic: {
          bitrate: number;
          dfsId: number;
          extension: string;
          id: number;
          playTime: number;
          size: number;
          sr: number;
          volumeDelta: number;
        };
        mvid: number;
        name: string;
        no: number;
        playedNum: number;
        popularity: number;
        position: number;
        ringtone: string;
        rtUrls: string[];
        rtype: number;
        score: number;
        starred: boolean;
        starredNum: number;
        status: number;
      };
      trackCount: number;
      userId: number;
    }[];
    resourceIds: number[];
  };
  rec_query: [null];
  sim_query: {
    more: boolean;
    sim_querys: { alg: string; keyword: string }[];
  };
  song: {
    more: boolean;
    moreText: string;
    resourceIds: number[];
    songs: {
      al: {
        id: number;
        name: string;
        pic: number;
        pic_str: string;
        picUrl: string;
        tns: string[];
      };
      alg: string;
      alia: string[];
      ar: { alia: string[]; alias: string[]; id: number; name: string; tns: string[] }[];
      cd: string;
      cf: string;
      copyright: number;
      cp: number;
      djId: number;
      dt: number;
      fee: number;
      ftype: number;
      h: H;
      hr?: Hr;
      id: number;
      l: L;
      lyrics: string;
      m: M;
      mark: number;
      mst: number;
      mv: number;
      name: string;
      no: number;
      officialTags: string[];
      originCoverType: number;
      pop: number;
      privilege: {
        chargeInfoList: { chargeType: number; rate: number }[];
        code: number;
        cp: number;
        cs: boolean;
        dl: number;
        dlLevel: string;
        downloadMaxbr: number;
        downloadMaxBrLevel: string;
        fee: number;
        fl: number;
        flag: number;
        flLevel: string;
        freeTrialPrivilege: {
          resConsumable: boolean;
          userConsumable: boolean;
        };
        id: number;
        maxbr: number;
        maxBrLevel: string;
        payed: number;
        pl: number;
        playMaxbr: number;
        playMaxBrLevel: string;
        plLevel: string;
        preSell: boolean;
        rightSource: number;
        sp: number;
        st: number;
        subp: number;
        toast: boolean;
      };
      pst: number;
      publishTime: number;
      recommendText: string;
      resourceState: boolean;
      rt: string;
      rtUrls: string[];
      rtype: number;
      s_id: number;
      showRecommend: boolean;
      single: number;
      specialTags: string[];
      sq: Sq;
      st: number;
      t: number;
      v: number;
      version: number;
    }[];
  };
  user: {
    more: boolean;
    moreText: string;
    resourceIds: number[];
    users: {
      accountStatus: number;
      alg: string;
      anchor: boolean;
      authenticationTypes: number;
      authority: number;
      authStatus: number;
      avatarDetail: {
        identityIconUrl: string;
        identityLevel: number;
        userType: number;
      };
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
      followed: boolean;
      gender: number;
      mutual: boolean;
      nickname: string;
      province: number;
      signature: string;
      userId: number;
      userType: number;
      vipType: number;
    }[];
  };
  voice: object;
  voicelist: object;
}

type NeteaseSearchResult<T extends keyof NeteaseSearchResultMap> = NeteaseSearchResultMap[T];

type NeteaseSearchResultMap = {
  song: NeteaseSearchSongResult;
  playlist: NeteaseSearchPlaylistResult;
  album: NeteaseSearchAlbumResult;
  artist: NeteaseSearchArtistResult;
  all: NeteaseSearchAllResult;
};

interface NeteaseSearchResultResponse<
  T extends keyof NeteaseSearchResultMap = any
> extends NeteaseAPIResponse {
  result: NeteaseSearchResult<T>;
}

interface NeteaseSearchSuggestionResponse extends NeteaseAPIResponse {
  result: {
    albums: {
      alia?: string[];
      artist: {
        albumSize: number;
        alia: string[];
        alias: string[];
        appendRecText: null;
        fansGroup: null;
        fansSize: null;
        id: number;
        img1v1: number;
        img1v1Url: string;
        musicSize: number;
        name: string;
        picId: number;
        picUrl: string;
        recommendText: null;
        trans: null;
      };
      copyrightId: number;
      id: number;
      mark: number;
      name: string;
      picId: number;
      publishTime: number;
      size: number;
      status: number;
    }[];
    artists: {
      accountId?: number;
      albumSize?: number;
      alia?: string[];
      alias?: string[];
      appendRecText?: null;
      fansGroup?: null;
      fansSize?: null;
      id?: number;
      img1v1?: number;
      img1v1Url?: string;
      musicSize?: number;
      name?: string;
      picId?: number;
      picUrl?: string;
      recommendText?: null;
      trans?: null;
    }[];
    order: string[];
    playlists: {
      action: null;
      actionType: null;
      bookCount: number;
      coverImgUrl: string;
      creator: null;
      description: string;
      highQuality: boolean;
      id: number;
      name: string;
      officialPlaylistTitle: null;
      officialTags: null;
      playCount: number;
      playlistType: string;
      recommendText: null;
      score: null;
      specialType: number;
      subscribed: boolean;
      trackCount: number;
      userId: number;
    }[];
    songs: {
      album: {
        alia?: string[];
        artist: {
          albumSize: number;
          alias: string[];
          appendRecText: null;
          fansGroup: null;
          fansSize: null;
          id: number;
          img1v1: number;
          img1v1Url: string;
          musicSize: number;
          name: string;
          picId: number;
          picUrl: null;
          recommendText: null;
          trans: null;
        };
        copyrightId: number;
        id: number;
        mark: number;
        name: string;
        picId: number;
        publishTime: number;
        size: number;
        status: number;
      };
      alias: string[];
      artists: {
        albumSize: number;
        alias: string[];
        appendRecText: null;
        fansGroup: null;
        fansSize: null;
        id: number;
        img1v1: number;
        img1v1Url: string;
        musicSize: number;
        name: string;
        picId: number;
        picUrl: null;
        recommendText: null;
        trans: null;
      }[];
      copyrightId: number;
      duration: number;
      fee: number;
      ftype: number;
      id: number;
      mark: number;
      mvid: number;
      name: string;
      rtype: number;
      rUrl: null;
      status: number;
      transNames?: string[];
    }[];
  };
}
