namespace NeteaseAPI {
  interface NeteaseSearchDefaultKeywordsResponse extends NeteaseAPIResponse {
    message: null;
    data: NeteaseSearchDefaultKeywords;
  }

  interface NeteaseSearchDefaultKeywords {
    alg: string;
    gap: number;
    source: null;
    trp_id: null;
    logInfo: null;
    action: number;
    imageUrl: null;
    trp_type: null;
    searchType: number;
    realkeyword: string;
    showKeyword: string;
    bizQueryInfo: string;
    styleKeyword: {
      descWord: null;
      keyWord: string;
    };
  }

  interface NeteaseSearchHotListDetailResponse extends NeteaseAPIResponse {
    message: string;
    trp: { rules: string[] };
    data: NeteaseSearchHotListDetail[];
  }

  interface NeteaseSearchHotListDetail {
    alg: string;
    url: string;
    score: number;
    source: number;
    content: string;
    iconType: number;
    searchWord: string;
    iconUrl: null | string;
  }

  interface NeteaseSearchSongResult {
    hasMore: boolean;
    songCount: number;
    songs: {
      id: number;
      rUrl: null;
      fee: number;
      mark: number;
      mvid: number;
      name: string;
      ftype: number;
      rtype: number;
      status: number;
      alias: string[];
      duration: number;
      copyrightId: number;
      transNames: string[];
      artists: {
        id: number;
        trans: null;
        name: string;
        picUrl: null;
        picId: number;
        fansSize: null;
        img1v1: number;
        alias: string[];
        fansGroup: null;
        albumSize: number;
        img1v1Url: string;
        musicSize: number;
        appendRecText: null;
        recommendText: null;
      }[];
      album: {
        id: number;
        mark: number;
        name: string;
        size: number;
        picId: number;
        status: number;
        alia?: string[];
        copyrightId: number;
        publishTime: number;
        transNames?: string[];
        artist: {
          id: number;
          trans: null;
          name: string;
          picUrl: null;
          picId: number;
          fansSize: null;
          img1v1: number;
          alias: string[];
          fansGroup: null;
          albumSize: number;
          img1v1Url: string;
          musicSize: number;
          appendRecText: null;
          recommendText: null;
        };
      };
    }[];
  }

  interface NeteaseSearchPlaylistResult {
    hasMore: boolean;
    hlWords: string[];
    playlistCount: number;
    searchQcReminder: null;
    playlists: {
      id: number;
      alg: string;
      score: null;
      name: string;
      action: string;
      userId: number;
      bookCount: number;
      playCount: number;
      actionType: string;
      trackCount: number;
      coverImgUrl: string;
      specialType: number;
      subscribed: boolean;
      highQuality: boolean;
      playlistType: string;
      recommendText: string;
      description: null | string;
      officialTags: null | string[];
      officialPlaylistTitle: null | string;
      creator: {
        experts: null;
        userId: number;
        expertTags: null;
        nickname: string;
        userType: number;
        avatarUrl: string;
        authStatus: number;
      };
    }[];
  }

  interface NeteaseSearchAlbumResult {
    hlWords: string[];
    albumCount: number;
    albums: {
      id: number;
      alg: string;
      pic: number;
      songs: null;
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
      onSale: boolean;
      briefDesc: string;
      companyId: number;
      picId_str: string;
      blurPicUrl: string;
      copyrightId: number;
      description: string;
      publishTime: number;
      transNames: string[];
      containedSong: string;
      company: null | string;
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
        alia: string[];
        picUrl: string;
        alias: string[];
        img1v1Id: number;
        albumSize: number;
        briefDesc: string;
        img1v1Url: string;
        musicSize: number;
        picId_str: string;
        topicPerson: number;
        img1v1Id_str: string;
      };
    }[];
  }

  interface NeteaseSearchArtistResult {
    hasMore: boolean;
    hlWords: string[];
    artistCount: number;
    searchQcReminder: null;
    artists: {
      id: number;
      alg: string;
      trans: null;
      name: string;
      picId: number;
      alia: string[];
      img1v1: number;
      mvSize: number;
      alias: string[];
      fansGroup: null;
      fansSize: number;
      accountId: number;
      albumSize: number;
      followed: boolean;
      img1v1Url: string;
      musicSize: number;
      appendRecText: string;
      picUrl: null | string;
      recommendText: string;
      identityIconUrl: string;
    }[];
  }

  interface NeteaseSearchAllResult {
    code: number;
    voice: object;
    order: string[];
    rec_query: [null];
    voicelist: object;
    new_mlog: { more: boolean; resources: string[] };
    sim_query: {
      more: boolean;
      sim_querys: { alg: string; keyword: string }[];
    };
    artist: {
      more: boolean;
      moreText: string;
      resourceIds: number[];
      artists: {
        id: number;
        alg: string;
        name: string;
        picId: number;
        alia: string[];
        img1v1: number;
        mvSize: number;
        picUrl: string;
        alias: string[];
        fansSize: number;
        accountId: number;
        albumSize: number;
        followed: boolean;
        img1v1Url: string;
        musicSize: number;
        identityIconUrl: string;
      }[];
    };
    user: {
      more: boolean;
      moreText: string;
      resourceIds: number[];
      users: {
        alg: string;
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
        detailDescription: string;
        backgroundImgIdStr: string;
        authenticationTypes: number;
        avatarDetail: {
          userType: number;
          identityLevel: number;
          identityIconUrl: string;
        };
      }[];
    };
    album: {
      more: boolean;
      moreText: string;
      resourceIds: number[];
      albums: {
        id: number;
        alg: string;
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
        company: string;
        onSale: boolean;
        briefDesc: string;
        companyId: number;
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
          alia: string[];
          picUrl: string;
          alias: string[];
          img1v1Id: number;
          albumSize: number;
          briefDesc: string;
          img1v1Url: string;
          musicSize: number;
          picId_str: string;
          topicPerson: number;
          img1v1Id_str: string;
        };
      }[];
    };
    song: {
      more: boolean;
      moreText: string;
      resourceIds: number[];
      songs: {
        h: H;
        l: L;
        m: M;
        sq: Sq;
        hr?: Hr;
        t: number;
        v: number;
        cd: string;
        cf: string;
        cp: number;
        dt: number;
        id: number;
        mv: number;
        no: number;
        rt: string;
        st: number;
        alg: string;
        fee: number;
        mst: number;
        pop: number;
        pst: number;
        djId: number;
        mark: number;
        name: string;
        s_id: number;
        ftype: number;
        rtype: number;
        alia: string[];
        lyrics: string;
        single: number;
        version: number;
        rtUrls: string[];
        copyright: number;
        publishTime: number;
        recommendText: string;
        specialTags: string[];
        officialTags: string[];
        resourceState: boolean;
        showRecommend: boolean;
        originCoverType: number;
        ar: { id: number; name: string; tns: string[]; alia: string[]; alias: string[] }[];
        al: {
          id: number;
          pic: number;
          name: string;
          tns: string[];
          picUrl: string;
          pic_str: string;
        };
        privilege: {
          cp: number;
          dl: number;
          fl: number;
          id: number;
          pl: number;
          sp: number;
          st: number;
          cs: boolean;
          fee: number;
          code: number;
          flag: number;
          subp: number;
          maxbr: number;
          payed: number;
          toast: boolean;
          dlLevel: string;
          flLevel: string;
          plLevel: string;
          preSell: boolean;
          playMaxbr: number;
          maxBrLevel: string;
          rightSource: number;
          downloadMaxbr: number;
          playMaxBrLevel: string;
          downloadMaxBrLevel: string;
          chargeInfoList: { rate: number; chargeType: number }[];
          freeTrialPrivilege: {
            resConsumable: boolean;
            userConsumable: boolean;
          };
        };
      }[];
    };
    playList: {
      more: boolean;
      moreText: string;
      resourceIds: number[];
      playLists: {
        id: number;
        alg: string;
        name: string;
        userId: number;
        bookCount: number;
        playCount: number;
        trackCount: number;
        coverImgUrl: string;
        description: string;
        specialType: number;
        subscribed: boolean;
        highQuality: boolean;
        playlistType: string;
        officialTags: string[];
        creator: {
          userId: number;
          nickname: string;
          userType: number;
          avatarUrl: string;
          authStatus: number;
        };
        track: {
          id: number;
          no: number;
          fee: number;
          disc: string;
          mvid: number;
          name: string;
          ftype: number;
          rtype: number;
          score: number;
          status: number;
          alias: string[];
          copyFrom: string;
          dayPlays: number;
          duration: number;
          hearTime: number;
          position: number;
          ringtone: string;
          rtUrls: string[];
          starred: boolean;
          copyright: number;
          playedNum: number;
          popularity: number;
          starredNum: number;
          copyrightId: number;
          commentThreadId: string;
          bMusic: {
            id: number;
            sr: number;
            size: number;
            dfsId: number;
            bitrate: number;
            playTime: number;
            extension: string;
            volumeDelta: number;
          };
          hMusic: {
            id: number;
            sr: number;
            size: number;
            dfsId: number;
            bitrate: number;
            playTime: number;
            extension: string;
            volumeDelta: number;
          };
          lMusic: {
            id: number;
            sr: number;
            size: number;
            dfsId: number;
            bitrate: number;
            playTime: number;
            extension: string;
            volumeDelta: number;
          };
          mMusic: {
            id: number;
            sr: number;
            size: number;
            dfsId: number;
            bitrate: number;
            playTime: number;
            extension: string;
            volumeDelta: number;
          };
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
            img1v1Url: string;
            musicSize: number;
            topicPerson: number;
          }[];
          album: {
            id: number;
            pic: number;
            mark: number;
            name: string;
            size: number;
            tags: string;
            type: string;
            picId: number;
            picUrl: string;
            status: number;
            alias: string[];
            company: string;
            gapless: number;
            onSale: boolean;
            songs: string[];
            briefDesc: string;
            companyId: number;
            picId_str: string;
            blurPicUrl: string;
            copyrightId: number;
            description: string;
            publishTime: number;
            commentThreadId: string;
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
              img1v1Url: string;
              musicSize: number;
              topicPerson: number;
            };
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
              img1v1Url: string;
              musicSize: number;
              topicPerson: number;
            }[];
          };
        };
      }[];
    };
  }

  type NeteaseSearchResult<T extends keyof NeteaseSearchResultMap> = NeteaseSearchResultMap[T];

  type NeteaseSearchResultMap = {
    all: NeteaseSearchAllResult;
    song: NeteaseSearchSongResult;
    album: NeteaseSearchAlbumResult;
    artist: NeteaseSearchArtistResult;
    playlist: NeteaseSearchPlaylistResult;
  };

  interface NeteaseSearchResultResponse<
    T extends keyof NeteaseSearchResultMap = any
  > extends NeteaseAPIResponse {
    result: NeteaseSearchResult<T>;
  }

  interface NeteaseSearchSuggestionResponse extends NeteaseAPIResponse {
    result: {
      order: string[];
      artists: {
        id?: number;
        trans?: null;
        name?: string;
        picId?: number;
        alia?: string[];
        fansSize?: null;
        img1v1?: number;
        picUrl?: string;
        alias?: string[];
        fansGroup?: null;
        accountId?: number;
        albumSize?: number;
        img1v1Url?: string;
        musicSize?: number;
        appendRecText?: null;
        recommendText?: null;
      }[];
      playlists: {
        id: number;
        score: null;
        action: null;
        name: string;
        creator: null;
        userId: number;
        actionType: null;
        bookCount: number;
        playCount: number;
        officialTags: null;
        trackCount: number;
        coverImgUrl: string;
        description: string;
        recommendText: null;
        specialType: number;
        subscribed: boolean;
        highQuality: boolean;
        playlistType: string;
        officialPlaylistTitle: null;
      }[];
      albums: {
        id: number;
        mark: number;
        name: string;
        size: number;
        picId: number;
        status: number;
        alia?: string[];
        copyrightId: number;
        publishTime: number;
        artist: {
          id: number;
          trans: null;
          name: string;
          picId: number;
          alia: string[];
          fansSize: null;
          img1v1: number;
          picUrl: string;
          alias: string[];
          fansGroup: null;
          albumSize: number;
          img1v1Url: string;
          musicSize: number;
          appendRecText: null;
          recommendText: null;
        };
      }[];
      songs: {
        id: number;
        rUrl: null;
        fee: number;
        mark: number;
        mvid: number;
        name: string;
        ftype: number;
        rtype: number;
        status: number;
        alias: string[];
        duration: number;
        copyrightId: number;
        transNames?: string[];
        artists: {
          id: number;
          trans: null;
          name: string;
          picUrl: null;
          picId: number;
          fansSize: null;
          img1v1: number;
          alias: string[];
          fansGroup: null;
          albumSize: number;
          img1v1Url: string;
          musicSize: number;
          appendRecText: null;
          recommendText: null;
        }[];
        album: {
          id: number;
          mark: number;
          name: string;
          size: number;
          picId: number;
          status: number;
          alia?: string[];
          copyrightId: number;
          publishTime: number;
          artist: {
            id: number;
            trans: null;
            name: string;
            picUrl: null;
            picId: number;
            fansSize: null;
            img1v1: number;
            alias: string[];
            fansGroup: null;
            albumSize: number;
            img1v1Url: string;
            musicSize: number;
            appendRecText: null;
            recommendText: null;
          };
        };
      }[];
    };
  }
}
