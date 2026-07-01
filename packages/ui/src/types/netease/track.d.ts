namespace NeteaseAPI {
  interface NeteaseTrackDetailResponse extends NeteaseAPIResponse {
    songs: NeteaseTrack[];
    privileges: NeteaseTrackPrivilege[];
  }

  interface NeteaseTrack extends NeteaseTrackBase {
    a: null;
    /** 云盘歌曲信息，如果不存在该字段，则为非云盘歌曲 */
    pc?: any;
    additionalTitle: null;
    /** 专辑，如果是DJ节目(dj_type != 0)或者无专辑信息(single == 1)，则专辑id为0 */
    al: Al;
    ar: Ar[];
    alg: null;
    awardTags: null;
    /** None或如"04", "1/2", "3", "null"的字符串，表示歌曲属于专辑中第几张CD，对应音频文件的Tag */
    cf: string;
    cp: number;
    crbt: null;
    djId: number;
    copyright: number;
    displayTags: null;
    displayReason: null;
    entertainmentTags: null;
    cd: null | "null" | string;
    /**
     * @enum
     *   0: 免费或无版权
     *   1: VIP 歌曲
     *   4: 购买专辑
     *   8: 非会员可免费播放低音质，会员可播放高音质及下载
     * @note fee 为 1 或 8 的歌曲均可单独购买 2 元单曲
     * */
    mst: number;
    ftype: number;
    mainTitle: null;
    fee: 0 | 1 | 4 | 8;
    /** 非零表示有MV ID */
    mv: number;
    /** 表示歌曲属于CD中第几曲，0表示没有这个字段，对应音频文件的Tag */
    no: number;
    noCopyrightRcmd: null;
    /**
     * @enum
     *   0: 未知
     *   1: 原曲
     *   2: 翻唱
     * */
    originCoverType: 0 | 1 | 2;
    originSongSimpleData: null;
    /** 小数，常取[0.0, 100.0]中离散的几个数值, 表示歌曲热度 */
    pop: number;
    pst: number;
    pubDJProgramData: null;
    /** 毫秒为单位的Unix时间戳 */
    rurl: null;
    st: number;
    rtUrl: null;
    s_id: number;
    rtype: number;
    single: number;
    rtUrls: string[];
    rt: null | string;
    songJumpInfo: null;
    publishTime: number;
    resourceState: boolean;

    /**
     * @author tuxzz[https://github.com/Binaryify/NeteaseCloudMusicApi/issues/1121#issuecomment-774438040]:
     * @enum {number}
     * @readonly
     * 0: 一般类型
     * 1: 通过云盘上传的音乐，网易云不存在公开对应
     *    - 如果没有权限将不可用，除了歌曲长度以外大部分信息都为 null。
     *    - 可以通过 `/api/v1/playlist/manipulate/tracks` 接口添加到播放列表。
     *    - 如果添加到“我喜欢的音乐”，则仅自己可见，除了长度以外各种信息均为未知，且无法播放。
     *    - 如果添加到一般播放列表，虽然返回 code 200，但是并没有效果。
     *    - 网页端打开会看到 404 画面。
     *    - 例子: https://music.163.com/song/1345937107
     * 2: 通过云盘上传的音乐，网易云存在公开对应
     *    - 如果没有权限则只能看到信息，但无法直接获取到文件。
     *    - 可以通过 `/api/v1/playlist/manipulate/tracks` 接口添加到播放列表。
     *    - 如果添加到“我喜欢的音乐”，则仅自己可见，且无法播放。
     *    - 如果添加到一般播放列表，则自己会看到显示“云盘文件”，且云盘会多出其对应的网易云公开歌曲。其他人看到的是其对应的网易云公开歌曲。
     *    - 网页端打开会看到 404 画面。
     *    - 例子: https://music.163.com/song/435005015
     */
    t: 0 | 1 | 2;
    tagPicList: null;
    /** 常为[1, ?]任意数字, 代表歌曲当前信息版本 */
    v: number;
    version: number;
  }

  interface NeteaseTrackBase {
    id: number;
    /** 歌曲标题 */
    dt: number;
    name: string;
    /** 别名列表，第一个别名会被显示作副标题 */
    alia: string[];
    tns?: string[];
    ar: {
      id: number;
      name: string;
    }[];
    al: {
      name: string;
      picUrl: string;
    };
    /**
     * 一些歌曲属性，用按位与操作获取对应位置的值
     *   8192 立体声?(不是很确定)
     *   131072 纯音乐
     *   262144 支持 杜比全景声(Dolby Atmos)
     *   1048576 脏标 🅴
     *   17179869184 支持 Hi-Res
     *   其他未知，理论上有从1到2^63共64种不同的信息
     *   专辑信息的mark字段也同理
     *   例子:id 1859245776 和 1859306637 为同一首歌，前者 mark & 1048576 == 1048576,后者 mark &   1048576 == 0，因此前者是脏版。
     * */
    h: H | null;
    l: L | null;
    m: M | null;
    mark: number;
    hr: Hr | null;
    sq: Sq | null;
  }

  interface NeteaseTrackPrivilege extends NeteaseSongPrivilege {
    /** 曲目 id。 */
    id: number;
    /** 付费类型标识（0 常见为免费，非 0 表示某种付费/VIP 限制，具体取值由服务端定义）。 */
    fee: number;
    /** 小于0时为灰色歌曲, 使用上传云盘的方法解灰后 st == 0。 */
    st: number;
    /** 播放权限/等级（play permission）。常用判断是 pl > 0 表示可播放，pl === 0 表示不可播放。具体值大小通常与允许的播放质量/权限粒度相关，需与 maxbr、fee 等联合判断。 */
    pl: number;
    /** 下载权限/等级，dl > 0 一般表示可下载。 */
    dl: number;
    /** 是否为云盘歌曲 */
    cs?: boolean;
    /** 当前帐号是否已购买/授权（数值/布尔，表示付费状态）。 */
    payed?: number;
    /** 额外的权限/标识字段（客户端常用来区分格式/位率限制等，具体含义不完全固定）。 */
    fl?: number;
    /*&* 允许的最大比特率（整数，单位通常为 bps）。 */
    maxbr?: number;
    /** 是否「由于版权保护，您所在的地区暂时无法使用。」 */
    toast?: boolean;
    /** 位掩码/标志位，可能包含多种权限或特殊标识（需查看具体实现确定各位含义）。 */
    flag?: number;
    /** 其余仍会影响可播状态但暂未明确定义的字段。 */
    bd: null;
    cp: number;
    code: number;
    chargeInfoList: ChargeInfoList[];
    /** 当前用户的该歌曲最高下载音质 */
    dlLevels: null;
    dlLevel: string;
    downloadMaxbr: number;
    downloadMaxBrLevel: string;
    /** 免费用户的该歌曲播放音质 */
    flLevel: string;
    ignoreCache: null;
    freeTrialPrivilege: FreeTrialPrivilege;
    /** 歌曲最高音质 */
    pc: null;
    message: null;
    playMaxbr: number;
    maxBrLevel: string;
    paidBigBang: boolean;
    playMaxBrLevel: string;
    /** 当前用户的该歌曲最高试听音质 */
    rscl: null;
    sp: number;
    subp: number;
    plLevels: null;
    plLevel: string;
    preSell: boolean;
    realPayed: number;
    rightSource: number;
  }

  interface ChargeInfoList {
    rate: number;
    chargeUrl: null;
    chargeType: number;
    chargeMessage: null;
  }

  interface FreeTrialPrivilege {
    listenType: null;
    playReason: null;
    resConsumable: boolean;
    userConsumable: boolean;
    cannotListenReason: null;
  }

  interface NeteaseQualityLevels {
    br: number;
  }

  /** 高质量文件信息 */
  interface H extends NeteaseQualityLevels {
    br: number;
    vd: number;
    fid: number;
    sr?: number;
    size: number;
  }

  /** 低质量文件信息 */
  interface L extends NeteaseQualityLevels {
    br: number;
    vd: number;
    fid: number;
    sr?: number;
    size: number;
  }

  /** 中质量文件信息 */
  interface M extends NeteaseQualityLevels {
    br: number;
    vd: number;
    fid: number;
    sr?: number;
    size: number;
  }

  /** 无损质量文件信息 */
  interface Sq extends NeteaseQualityLevels {
    br: number;
    vd: number;
    fid: number;
    sr?: number;
    size: number;
  }

  /** Hi-Res质量文件信息 */
  interface Hr extends NeteaseQualityLevels {
    br: number;
    vd: number;
    fid: number;
    sr?: number;
    size: number;
  }

  interface NeteaseDailyRecommendTracksResponse extends NeteaseAPIResponse {
    data: DailyRecommendTracksData;
  }

  interface DailyRecommendTracksData {
    demote: boolean;
    fromCache: boolean;
    orderSongs: string[];
    mvResourceInfos: null;
    algReturnDemote: boolean;
    dailyRecommendInfo: null;
    dailySongs: DailyRecommendTracksDailySong[];
    recommendReasons: DailyRecommendTracksRecommendReason[];
  }

  interface DailyRecommendTracksDailySong {
    h: H;
    l: L;
    m: M;
    al: Al;
    sq: Sq;
    a: null;
    ar: Ar[];
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
    alg: string;
    mst: number;
    pop: number;
    pst: number;
    rtUrl: null;
    djId: number;
    mark: number;
    name: string;
    s_id: number;
    ftype: number;
    hr: Hr | null;
    rtype: number;
    tns: string[];
    alia: string[];
    single: number;
    awardTags: null;
    version: number;
    rtUrls: string[];
    tagPicList: null;
    copyright: number;
    displayTags: null;
    rt: null | string;
    fee: 0 | 1 | 4 | 8;
    songJumpInfo: null;
    publishTime: number;
    noCopyrightRcmd: null;
    reason: null | string;
    resourceState: boolean;
    entertainmentTags: null;
    mainTitle: null | string;
    originCoverType: 0 | 1 | 2;
    originSongSimpleData: null;
    additionalTitle: null | string;
    recommendReason: null | string;
    privilege: NeteaseTrackPrivilege;
  }

  interface ChargeInfoList {
    rate: number;
    chargeUrl: null;
    chargeType: number;
    chargeMessage: null;
  }

  interface DailyRecommendTracksRecommendReason {
    reason: string;
    songId: number;
    targetUrl: null;
    reasonId: string;
  }

  interface NeteaseTrackChorusResponse extends NeteaseAPIResponse {
    data: NeteaseChorusData[];
    chorus: NeteaseChorusData[];
  }

  interface NeteaseChorusData {
    id: number;
    endTime: number;
    startTime: number;
    ugcLocked: number;
  }

  interface NeteasePersonalFMResponse extends NeteaseAPIResponse {
    popAdjust: boolean;
    data: PersonalFMTrack[];
  }

  interface PersonalFMTrack {
    crbt: null;
    id: number;
    no: number;
    rurl: null;
    sign: null;
    alg: string;
    fee: number;
    rtUrl: null;
    disc: string;
    mp3Url: null;
    mvid: number;
    name: string;
    ftype: number;
    rtype: number;
    score: number;
    audition: null;
    bMusic: BMusic;
    hMusic: HMusic;
    lMusic: LMusic;
    mMusic: MMusic;
    status: number;
    alias: string[];
    reason?: string;
    copyFrom: string;
    dayPlays: number;
    duration: number;
    hearTime: number;
    position: number;
    rtUrls: string[];
    starred: boolean;
    copyright: number;
    playedNum: number;
    reasonId?: string;
    popularity: number;
    starredNum: number;
    copyrightId: number;
    publishTime: number;
    transNames?: string[];
    artists: DatumArtist[];
    commentThreadId: string;
    ringtone: null | string;
    transName: null | string;
    album: {
      id: number;
      pic: number;
      name: string;
      size: number;
      tags: string;
      type: string;
      picId: number;
      picUrl: string;
      status: number;
      alias: string[];
      company: string;
      songs: string[];
      subType: string;
      transName: null;
      briefDesc: string;
      companyId: number;
      picId_str: string;
      blurPicUrl: string;
      copyrightId: number;
      description: string;
      publishTime: number;
      artist: PurpleArtist;
      artists: FluffyArtist[];
      commentThreadId: string;
    };
    privilege: {
      bd: null;
      pc: null;
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
      realPayed: number;
      maxBrLevel: string;
      rightSource: number;
      paidBigBang: boolean;
      downloadMaxbr: number;
      playMaxBrLevel: string;
      downloadMaxBrLevel: string;
      chargeInfoList: {
        rate: number;
        chargeUrl: null;
        chargeType: number;
        chargeMessage: null;
      }[];
      freeTrialPrivilege: {
        listenType: null;
        playReason: null;
        freeLimitTagType: null;
        resConsumable: boolean;
        userConsumable: boolean;
        cannotListenReason: null;
      };
    };
  }
}
