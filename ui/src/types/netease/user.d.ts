namespace NeteaseAPI {
  interface NeteaseUserAccountResponse extends NeteaseAPIResponse {
    account: {
      id: number;
      userName: string;
      type: number;
      status: number;
      whitelistAuthority: number;
      createTime: number;
      tokenVersion: number;
      ban: number;
      baoyueVersion: number;
      donateVersion: number;
      vipType: number;
      anonimousUser: boolean;
      paidFee: boolean;
    };
    profile: {
      userId: number;
      userType: number;
      nickname: string;
      avatarImgId: number;
      avatarUrl: string;
      backgroundImgId: number;
      backgroundUrl: string;
      signature: string;
      createTime: number;
      userName: string;
      accountType: number;
      shortUserName: string;
      birthday: number;
      authority: number;
      gender: number;
      accountStatus: number;
      province: number;
      city: number;
      authStatus: number;
      description: null;
      detailDescription: null;
      defaultAvatar: boolean;
      expertTags: null;
      experts: null;
      djStatus: number;
      locationStatus: number;
      vipType: number;
      followed: boolean;
      mutual: boolean;
      authenticated: boolean;
      lastLoginTime: number;
      lastLoginIP: string;
      remarkName: null;
      viptypeVersion: number;
      authenticationTypes: number;
      avatarDetail: null;
      anchor: boolean;
    };
  }

  interface NeteaseUserDetailResponse extends NeteaseAPIResponse {
    level: number;
    listenSongs: number;
    userPoint: {
      userId: number;
      balance: number;
      updateTime: number;
      version: number;
      status: number;
      blockBalance: number;
    };
    mobileSign: boolean;
    pcSign: boolean;
    profile: {
      privacyItemUnlimit: {
        area: boolean;
        college: boolean;
        gender: boolean;
        age: boolean;
        villageAge: boolean;
      };
      avatarDetail: null;
      defaultAvatar: boolean;
      followed: boolean;
      nickname: string;
      authStatus: number;
      expertTags: null;
      experts: object;
      avatarUrl: string;
      backgroundImgId: number;
      backgroundUrl: string;
      userType: number;
      city: number;
      djStatus: number;
      detailDescription: string;
      gender: number;
      avatarImgId: number;
      vipType: number;
      mutual: boolean;
      remarkName: null;
      province: number;
      accountStatus: number;
      avatarImgIdStr: string;
      backgroundImgIdStr: string;
      description: string;
      createTime: number;
      userId: number;
      birthday: number;
      signature: string;
      authority: number;
      followeds: number;
      follows: number;
      blacklist: boolean;
      eventCount: number;
      allSubscribedCount: number;
      playlistBeSubscribedCount: number;
      followTime: null;
      followMe: boolean;
      artistIdentity: [];
      cCount: number;
      inBlacklist: boolean;
      sDJPCount: number;
      playlistCount: number;
      sCount: number;
      newFollows: number;
    };
    peopleCanSeeMyPlayRecord: boolean;
    bindings: {
      expiresIn: number;
      refreshTime: number;
      bindingTime: number;
      tokenJsonStr: null;
      url: string;
      expired: boolean;
      userId: number;
      id: number;
      type: number;
    }[];
    adValid: boolean;
    newUser: boolean;
    recallUser: boolean;
    createTime: number;
    createDays: number;
    profileVillageInfo: {
      title: number;
      imageUrl: null | string;
      targetUrl: string;
    };
  }

}
