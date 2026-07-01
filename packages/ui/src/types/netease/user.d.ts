namespace NeteaseAPI {
  interface NeteaseUserAccountResponse extends NeteaseAPIResponse {
    account: {
      id: number;
      ban: number;
      type: number;
      status: number;
      vipType: number;
      paidFee: boolean;
      userName: string;
      createTime: number;
      tokenVersion: number;
      baoyueVersion: number;
      donateVersion: number;
      anonimousUser: boolean;
      whitelistAuthority: number;
    };
    profile: {
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
      userName: string;
      userType: number;
      authority: number;
      avatarUrl: string;
      description: null;
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
      detailDescription: null;
      authenticationTypes: number;
    };
  }

  interface NeteaseUserDetailResponse extends NeteaseAPIResponse {
    level: number;
    pcSign: boolean;
    adValid: boolean;
    newUser: boolean;
    createDays: number;
    createTime: number;
    listenSongs: number;
    mobileSign: boolean;
    recallUser: boolean;
    peopleCanSeeMyPlayRecord: boolean;
    profileVillageInfo: {
      title: number;
      targetUrl: string;
      imageUrl: null | string;
    };
    userPoint: {
      status: number;
      userId: number;
      balance: number;
      version: number;
      updateTime: number;
      blockBalance: number;
    };
    bindings: {
      id: number;
      url: string;
      type: number;
      userId: number;
      expired: boolean;
      expiresIn: number;
      tokenJsonStr: null;
      bindingTime: number;
      refreshTime: number;
    }[];
    profile: {
      city: number;
      cCount: number;
      gender: number;
      sCount: number;
      userId: number;
      experts: object;
      follows: number;
      mutual: boolean;
      vipType: number;
      birthday: number;
      djStatus: number;
      expertTags: null;
      followTime: null;
      nickname: string;
      province: number;
      remarkName: null;
      userType: number;
      authority: number;
      avatarUrl: string;
      followed: boolean;
      followeds: number;
      followMe: boolean;
      sDJPCount: number;
      signature: string;
      artistIdentity: [];
      authStatus: number;
      avatarDetail: null;
      blacklist: boolean;
      createTime: number;
      eventCount: number;
      newFollows: number;
      avatarImgId: number;
      description: string;
      inBlacklist: boolean;
      accountStatus: number;
      backgroundUrl: string;
      playlistCount: number;
      avatarImgIdStr: string;
      defaultAvatar: boolean;
      backgroundImgId: number;
      detailDescription: string;
      allSubscribedCount: number;
      backgroundImgIdStr: string;
      playlistBeSubscribedCount: number;
      privacyItemUnlimit: {
        age: boolean;
        area: boolean;
        gender: boolean;
        college: boolean;
        villageAge: boolean;
      };
    };
  }
}
