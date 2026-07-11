namespace NeteaseAPI {
  interface NeteaseCommentsNewResponse extends NeteaseAPIResponse {
    message: string;
    data: NeteaseCommentsPage;
  }

  interface NeteaseCommentsPage {
    style: string;
    cursor: string;
    hasMore: boolean;
    sortType: number;
    bottomAction: null;
    totalCount: number;
    expandCount: number;
    currentComment: null;
    commentsTitle: string;
    comments: NeteaseComment[];
    currentCommentTitle: string;
    likeAnimation: LikeAnimation;
    newReplyExpGroupName: string;
    sortTypeList: SortTypeList[];
  }

  interface NeteaseComment {
    tag: Tag;
    tail: null;
    user: User;
    grade: null;
    medal: null;
    args: string;
    reward: null;
    source: null;
    time: number;
    track: string;
    liked: boolean;
    owner: boolean;
    pickInfo: null;
    status: number;
    beReplied: null;
    content: string;
    privacy: number;
    timeStr: string;
    topicList: null;
    threadId: string;
    userTop: boolean;
    commentId: number;
    voiceNosKey: null;
    highlight: boolean;
    likedCount: number;
    replyCount: number;
    voiceWhaleId: null;
    contentPicExt: null;
    contentPicUrl: null;
    expressionUrl: null;
    userBizLevels: null;
    wordMatchList: null;
    airborneAction: null;
    bottomTags: string[];
    hideSerialTips: null;
    repliedMark: boolean;
    userNameplates: null;
    contentResource: null;
    contentPicNosKey: null;
    extInfo: CommentextInfo;
    parentCommentId: number;
    hideSerialComments: null;
    needDisplayTime: boolean;
    musicianSayAirborne: null;
    outShowComments: string[];
    resourceSpecialType: null;
    richContent: null | string;
    commentLocationType: number;
    ipLocation: null | IpLocation;
    commentVideoVO: CommentVideoVO;
    pendantData: null | PendantData;
    voiceDurationMillSecond: number;
    decoration: { [key: string]: any };
    showFloorComment: ShowFloorComment;
    likeAnimationMap: { [key: string]: any };
  }

  interface CommentVideoVO {
    videoCount: number;
    playOrpheusUrl: null;
    allowCreation: boolean;
    creationOrpheusUrl: null;
    forbidCreationText: string;
    showCreationEntrance: boolean;
  }

  interface CommentextInfo {
    forwardEvent: number;
    asyncEvent?: AsyncEvent;
  }

  interface AsyncEvent {
    syncEventId: string;
    syncEventType: number;
  }

  interface IpLocation {
    ip: null;
    location: string;
    userId: null | number;
  }

  interface PendantData {
    id: number;
    imageUrl: string;
  }

  interface ShowFloorComment {
    target: null;
    comments: null;
    replyCount: number;
    topCommentIds: null;
    showReplyCount: boolean;
  }

  interface Tag {
    datas: string[];
    extDatas: string[];
    contentDatas: string[];
    relatedCommentIds: null;
    contentPicDatas: string[];
  }

  interface User {
    target: null;
    experts: null;
    anonym: number;
    isHug: boolean;
    liveInfo: null;
    userId: number;
    vipType: number;
    expertTags: null;
    nickname: string;
    remarkName: null;
    userType: number;
    avatarUrl: string;
    followed: boolean;
    relationTag: null;
    authStatus: number;
    avatarDetail: null;
    locationInfo: null;
    socialUserId: null;
    commonIdentity: null;
    vipRights: VipRights;
    encryptUserId: string;
  }

  interface VipRights {
    memberLogo: null;
    redVipLevel: number;
    relationType: number;
    associator: Associator;
    redplus: null | Redplus;
    extInfo: VipRightsextInfo;
    redVipAnnualCount: number;
    musicPackage: MusicPackage;
  }

  interface Associator {
    iconUrl: string;
    rights: boolean;
    vipCode: number;
  }

  interface VipRightsextInfo {
    logo: Logo;
  }

  interface Logo {
    vipType: number;
    logoDto: LogoDto;
  }

  interface LogoDto {
    url: string;
    width: number;
    height: number;
    logoType: number;
    actionUrl: string;
    interestId: number;
  }

  interface MusicPackage {
    iconUrl: string;
    rights: boolean;
    vipCode: number;
  }

  interface Redplus {
    iconUrl: string;
    rights: boolean;
    vipCode: number;
  }

  interface LikeAnimation {
    version: number;
    animationConfigMap: AnimationConfigMap;
  }

  interface AnimationConfigMap {
    INPUT: string[];
    MOMENT: string[];
    EVENT_FEED: string[];
    COMMENT_AREA: string[];
  }

  interface SortTypeList {
    target: string;
    sortType: number;
    sortTypeName: string;
  }
}
