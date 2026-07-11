namespace NeteaseAPI {
  interface NeteaseSongUrlResponse extends NeteaseAPIResponse {
    data: NeteaseSongUrlItem[];
  }

  interface NeteaseLikedSongIdsResponse extends NeteaseAPIResponse {
    ids: number[];
    checkPoint: number;
  }

  interface NeteaseSongUrlItem {
    br: number;
    id: number;
    url: string;
    size: number;
    type: string;
    encodeType?: string;
    /** 试听片段附加信息。 */
    freeTrialInfo?: null | Record<string, any>;
  }

  interface NeteaseTopSongResponse extends NeteaseAPIResponse {
    data: Datum[];
  }

  interface Datum {
    crbt: null;
    id: number;
    no: number;
    rurl: null;
    st: number;
    fee: number;
    rtUrl: null;
    album: Album;
    disc: string;
    mvid: number;
    name: string;
    rtUrls: null;
    ftype: number;
    rtype: number;
    score: number;
    audition: null;
    bMusic: BMusic;
    hMusic: HMusic;
    lMusic: LMusic;
    mMusic: MMusic;
    status: number;
    albumData: null;
    alias: string[];
    videoInfo: null;
    copyFrom: string;
    dayPlays: number;
    duration: number;
    hearTime: number;
    position: number;
    ringtone: string;
    starred: boolean;
    playedNum: number;
    exclusive: boolean;
    popularity: number;
    relatedVideo: null;
    starredNum: number;
    copyrightId: number;
    transNames: string[];
    mp3Url: null | string;
    artists: DatumArtist[];
    commentThreadId: string;
    privilege: NeteaseSongPrivilege;
  }

  interface Album {
    id: number;
    pic: number;
    songs: null;
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
    subType: string;
    briefDesc: string;
    companyId: number;
    picId_str: string;
    blurPicUrl: string;
    copyrightId: number;
    description: string;
    publishTime: number;
    artist: PurpleArtist;
    transNames?: string[];
    artists: FluffyArtist[];
    commentThreadId: string;
    onSale: boolean;
  }

  interface PurpleArtist {
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
  }

  interface FluffyArtist {
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
  }

  interface DatumArtist {
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
  }

  interface BMusic {
    id: number;
    name: null;
    sr: number;
    size: number;
    dfsId: number;
    bitrate: number;
    playTime: number;
    extension: string;
    volumeDelta: number;
  }

  interface HMusic {
    id: number;
    name: null;
    sr: number;
    size: number;
    dfsId: number;
    bitrate: number;
    playTime: number;
    extension: string;
    volumeDelta: number;
  }

  interface LMusic {
    id: number;
    name: null;
    sr: number;
    size: number;
    dfsId: number;
    bitrate: number;
    playTime: number;
    extension: string;
    volumeDelta: number;
  }

  interface MMusic {
    id: number;
    name: null;
    sr: number;
    size: number;
    dfsId: number;
    bitrate: number;
    playTime: number;
    extension: string;
    volumeDelta: number;
  }

  interface NeteaseSongPrivilege {
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
    chargeInfoList: ChargeInfoList[];
    freeTrialPrivilege: FreeTrialPrivilege;
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
    uf: null | unknown;
    /** 是否已付费，0 通常表示未付费 */
    payed: number;
    /** 权限/状态标记，位标记形式 */
    flag: number;
    /** 是否可以扩展音质或其他能力 */
    canExtend: boolean;
    /** 免费试听信息，当前返回为 null */
    freeTrialInfo: null | unknown;
    /** 音质等级，例如 standard、higher、exhigh、lossless */
    level: string;
    /** 编码类型，例如 mp3 */
    encodeType: string;
    /** 声道布局信息，当前返回为 null */
    channelLayout: null | unknown;
    /** 免费试听权限 */
    freeTrialPrivilege: {
      /** 资源本身是否可免费试听 */
      resConsumable: boolean;
      /** 当前用户是否可免费试听 */
      userConsumable: boolean;
      /** 试听类型，当前返回为 null */
      listenType: null | unknown;
      /** 不能播放的原因，当前返回为 null */
      cannotListenReason: null | unknown;
      /** 可以播放的原因，当前返回为 null */
      playReason: null | unknown;
      /** 免费限制标签类型，当前返回为 null */
      freeLimitTagType: null | unknown;
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
    podcastCtrp: null | unknown;
    /** 音效类型，当前返回为 null */
    effectTypes: null | unknown;
    /** 歌曲时长，单位毫秒 */
    time: number;
    /** 错误或提示信息，正常时通常为 null */
    message: null | string;
    /** 音质混淆信息，当前返回为 null */
    levelConfuse: null | unknown;
    /** 字符串形式的歌曲 ID */
    musicId: string;
    /** 伴奏信息，当前返回为 null */
    accompany: null | unknown;
    /** 采样率，例如 44100 */
    sr: number;
    /** 音频效果信息，当前返回为 null */
    auEff: null | unknown;
    /** 沉浸类型，当前返回为 null */
    immerseType: null | unknown;
    /** 节拍类型 */
    beatType: number;
  }
}
