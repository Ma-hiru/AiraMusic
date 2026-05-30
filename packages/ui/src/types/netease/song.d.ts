namespace NeteaseAPI {
  interface NeteaseSongUrlResponse extends NeteaseAPIResponse {
    data: NeteaseSongUrlItem[];
  }

  interface NeteaseLikedSongIdsResponse extends NeteaseAPIResponse {
    ids: number[];
    checkPoint: number;
  }

  interface NeteaseSongUrlItem {
    id: number;
    url: string;
    br: number;
    size: number;
    type: string;
    encodeType?: string;
    /** 试听片段附加信息。 */
    freeTrialInfo?: Record<string, any> | null;
  }

  interface NeteaseTopSongResponse extends NeteaseAPIResponse {
    data: Datum[];
  }

  interface Datum {
    album: Album;
    albumData: null;
    alias: string[];
    artists: DatumArtist[];
    audition: null;
    bMusic: BMusic;
    commentThreadId: string;
    copyFrom: string;
    copyrightId: number;
    crbt: null;
    dayPlays: number;
    disc: string;
    duration: number;
    exclusive: boolean;
    fee: number;
    ftype: number;
    hearTime: number;
    hMusic: HMusic;
    id: number;
    lMusic: LMusic;
    mMusic: MMusic;
    mp3Url: null | string;
    mvid: number;
    name: string;
    no: number;
    playedNum: number;
    popularity: number;
    position: number;
    privilege: NeteaseSongPrivilege;
    relatedVideo: null;
    ringtone: string;
    rtUrl: null;
    rtUrls: null;
    rtype: number;
    rurl: null;
    score: number;
    st: number;
    starred: boolean;
    starredNum: number;
    status: number;
    transNames: string[];
    videoInfo: null;
  }

  interface Album {
    alias: string[];
    artist: PurpleArtist;
    artists: FluffyArtist[];
    blurPicUrl: string;
    briefDesc: string;
    commentThreadId: string;
    company: string;
    companyId: number;
    copyrightId: number;
    description: string;
    id: number;
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
    subType: string;
    tags: string;
    transNames?: string[];
    type: string;
  }

  interface PurpleArtist {
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
  }

  interface FluffyArtist {
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
  }

  interface DatumArtist {
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
  }

  interface BMusic {
    bitrate: number;
    dfsId: number;
    extension: string;
    id: number;
    name: null;
    playTime: number;
    size: number;
    sr: number;
    volumeDelta: number;
  }

  interface HMusic {
    bitrate: number;
    dfsId: number;
    extension: string;
    id: number;
    name: null;
    playTime: number;
    size: number;
    sr: number;
    volumeDelta: number;
  }

  interface LMusic {
    bitrate: number;
    dfsId: number;
    extension: string;
    id: number;
    name: null;
    playTime: number;
    size: number;
    sr: number;
    volumeDelta: number;
  }

  interface MMusic {
    bitrate: number;
    dfsId: number;
    extension: string;
    id: number;
    name: null;
    playTime: number;
    size: number;
    sr: number;
    volumeDelta: number;
  }

  interface NeteaseSongPrivilege {
    chargeInfoList: ChargeInfoList[];
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
    freeTrialPrivilege: FreeTrialPrivilege;
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
    rscl: null;
    sp: number;
    st: number;
    subp: number;
    toast: boolean;
  }

  interface NeteaseSongUrlNewResponse extends NeteaseAPIResponse {
    code: number;
    data: NeteaseSongUrlNewItem[];
  }

  interface NeteaseSongUrlNewItem {
    /** 歌曲 ID，通常是数字类型 */
    id: number;
    /** 实际播放地址，可能会过期，也可能为 null */
    url: string;
    /** 码率，单位一般是 bps，例如 320000、999000、1005005 */
    br: number;
    /** 文件大小，单位 byte */
    size: number;
    /** 文件 md5，用于校验文件内容 */
    md5: string;
    /** 当前歌曲 URL 的状态码，200 表示正常 */
    code: number;
    /** URL 过期时间，单位一般是秒 */
    expi: number;
    /** 音频文件类型，例如 mp3、flac */
    type: string;
    /** 音量增益，用于响度归一化 */
    gain: number;
    /** 音频峰值，通常用于播放音量控制 */
    peak: number;
    /** 封闭场景下的音量增益 */
    closedGain: number;
    /** 封闭场景下的音频峰值 */
    closedPeak: number;
    /** 版权/付费标记，0 通常表示免费或可播放 */
    fee: number;
    /** 未知字段，当前返回为 null */
    uf: unknown | null;
    /** 是否已付费，0 通常表示未付费 */
    payed: number;
    /** 权限/状态标记，位标记形式 */
    flag: number;
    /** 是否可以扩展音质或其他能力 */
    canExtend: boolean;
    /** 免费试听信息，当前返回为 null */
    freeTrialInfo: unknown | null;
    /** 音质等级，例如 standard、higher、exhigh、lossless */
    level: string;
    /** 编码类型，例如 mp3 */
    encodeType: string;
    /** 声道布局信息，当前返回为 null */
    channelLayout: unknown | null;
    /** 免费试听权限 */
    freeTrialPrivilege: {
      /** 资源本身是否可免费试听 */
      resConsumable: boolean;
      /** 当前用户是否可免费试听 */
      userConsumable: boolean;
      /** 试听类型，当前返回为 null */
      listenType: unknown | null;
      /** 不能播放的原因，当前返回为 null */
      cannotListenReason: unknown | null;
      /** 可以播放的原因，当前返回为 null */
      playReason: unknown | null;
      /** 免费限制标签类型，当前返回为 null */
      freeLimitTagType: unknown | null;
    };
    /** 限时免费试听权限 */
    freeTimeTrialPrivilege: {
      /** 资源是否支持限时试听 */
      resConsumable: boolean;
      /** 当前用户是否支持限时试听 */
      userConsumable: boolean;
      /** 限时试听类型 */
      type: number;
      /** 剩余试听时间 */
      remainTime: number;
    };
    /** URL 来源 */
    urlSource: number;
    /** 权限来源 */
    rightSource: number;
    /** 播客相关字段，当前返回为 null */
    podcastCtrp: unknown | null;
    /** 音效类型，当前返回为 null */
    effectTypes: unknown | null;
    /** 歌曲时长，单位毫秒 */
    time: number;
    /** 错误或提示信息，正常时通常为 null */
    message: string | null;
    /** 音质混淆信息，当前返回为 null */
    levelConfuse: unknown | null;
    /** 字符串形式的歌曲 ID */
    musicId: string;
    /** 伴奏信息，当前返回为 null */
    accompany: unknown | null;
    /** 采样率，例如 44100 */
    sr: number;
    /** 音频效果信息，当前返回为 null */
    auEff: unknown | null;
    /** 沉浸类型，当前返回为 null */
    immerseType: unknown | null;
    /** 节拍类型 */
    beatType: number;
  }
}
