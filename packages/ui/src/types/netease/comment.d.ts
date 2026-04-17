namespace NeteaseAPI {
  interface NeteaseCommentsNewResponse extends NeteaseAPIResponse {
    data: NeteaseCommentsPage;
    message: string;
  }

  interface NeteaseCommentsPage {
    bottomAction: null;
    comments: NeteaseComment[];
    commentsTitle: string;
    currentComment: null;
    currentCommentTitle: string;
    cursor: string;
    expandCount: number;
    hasMore: boolean;
    likeAnimation: LikeAnimation;
    newReplyExpGroupName: string;
    sortType: number;
    sortTypeList: SortTypeList[];
    style: string;
    totalCount: number;
  }

  interface NeteaseComment {
    airborneAction: null;
    args: string;
    beReplied: null;
    bottomTags: string[];
    commentId: number;
    commentLocationType: number;
    commentVideoVO: CommentVideoVO;
    content: string;
    contentPicExt: null;
    contentPicNosKey: null;
    contentPicUrl: null;
    contentResource: null;
    decoration: { [key: string]: any };
    expressionUrl: null;
    extInfo: CommentextInfo;
    grade: null;
    hideSerialComments: null;
    hideSerialTips: null;
    highlight: boolean;
    ipLocation: IpLocation;
    likeAnimationMap: { [key: string]: any };
    liked: boolean;
    likedCount: number;
    medal: null;
    musicianSayAirborne: null;
    needDisplayTime: boolean;
    outShowComments: string[];
    owner: boolean;
    parentCommentId: number;
    pendantData: null | PendantData;
    pickInfo: null;
    privacy: number;
    repliedMark: boolean;
    replyCount: number;
    resourceSpecialType: null;
    reward: null;
    richContent: null | string;
    showFloorComment: ShowFloorComment;
    source: null;
    status: number;
    tag: Tag;
    tail: null;
    threadId: string;
    time: number;
    timeStr: string;
    topicList: null;
    track: string;
    user: User;
    userBizLevels: null;
    userNameplates: null;
    userTop: boolean;
    voiceDurationMillSecond: number;
    voiceNosKey: null;
    voiceWhaleId: null;
    wordMatchList: null;
  }

  interface CommentVideoVO {
    allowCreation: boolean;
    creationOrpheusUrl: null;
    forbidCreationText: string;
    playOrpheusUrl: null;
    showCreationEntrance: boolean;
    videoCount: number;
  }

  interface CommentextInfo {
    asyncEvent?: AsyncEvent;
    forwardEvent: number;
  }

  interface AsyncEvent {
    syncEventId: string;
    syncEventType: number;
  }

  interface IpLocation {
    ip: null;
    location: string;
    userId: number | null;
  }

  interface PendantData {
    id: number;
    imageUrl: string;
  }

  interface ShowFloorComment {
    comments: null;
    replyCount: number;
    showReplyCount: boolean;
    target: null;
    topCommentIds: null;
  }

  interface Tag {
    contentDatas: string[];
    contentPicDatas: string[];
    datas: string[];
    extDatas: string[];
    relatedCommentIds: null;
  }

  interface User {
    anonym: number;
    authStatus: number;
    avatarDetail: null;
    avatarUrl: string;
    commonIdentity: null;
    encryptUserId: string;
    experts: null;
    expertTags: null;
    followed: boolean;
    isHug: boolean;
    liveInfo: null;
    locationInfo: null;
    nickname: string;
    relationTag: null;
    remarkName: null;
    socialUserId: null;
    target: null;
    userId: number;
    userType: number;
    vipRights: VipRights;
    vipType: number;
  }

  interface VipRights {
    associator: Associator;
    extInfo: VipRightsextInfo;
    memberLogo: null;
    musicPackage: MusicPackage;
    redplus: null | Redplus;
    redVipAnnualCount: number;
    redVipLevel: number;
    relationType: number;
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
    logoDto: LogoDto;
    vipType: number;
  }

  interface LogoDto {
    actionUrl: string;
    height: number;
    interestId: number;
    logoType: number;
    url: string;
    width: number;
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
    animationConfigMap: AnimationConfigMap;
    version: number;
  }

  interface AnimationConfigMap {
    COMMENT_AREA: string[];
    EVENT_FEED: string[];
    INPUT: string[];
    MOMENT: string[];
  }

  interface SortTypeList {
    sortType: number;
    sortTypeName: string;
    target: string;
  }
}
