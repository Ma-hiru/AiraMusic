interface Quality {
  br: number;
  fid: number;
  size: number;
  sr?: number;
  vd: number;
}

interface NeteaseTrackModel {
  id: number;
  /** 歌曲标题 */
  name: string;
  dt: number;
  /** 别名列表，第一个别名会被显示作副标题 */
  alia: string[];
  tns?: string[];
  ar: {
    alias: string[];
    id: number;
    name: string;
    tns: string[];
  }[];
  al: {
    id: number;
    name: string;
    pic: number;
    picUrl: string;
    tns: string[];
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
  mark: number;
  sq: null | Quality;
  h: null | Quality;
  hr: null | Quality;
  l: null | Quality;
  m: null | Quality;
  fee: 0 | 1 | 4 | 8;
  mv: number;
  no: number;
  originCoverType: 0 | 1 | 2;
  pop: number;
  publishTime: number;
  noCopyrightRcmd: any;
  privilege: null | {
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
    chargeInfoList: { chargeMessage: null; chargeType: number; chargeUrl: null; rate: number }[];
    code: number;
    cp: number;
    /** 当前用户的该歌曲最高下载音质 */
    dlLevel: string;
    dlLevels: null;
    downloadMaxbr: number;
    downloadMaxBrLevel: string;
    /** 免费用户的该歌曲播放音质 */
    flLevel: string;
    freeTrialPrivilege: {
      cannotListenReason: null;
      listenType: null;
      playReason: null;
      resConsumable: boolean;
      userConsumable: boolean;
    };
    ignoreCache: null;
    /** 歌曲最高音质 */
    maxBrLevel: string;
    message: null;
    paidBigBang: boolean;
    pc: null;
    playMaxbr: number;
    playMaxBrLevel: string;
    /** 当前用户的该歌曲最高试听音质 */
    plLevel: string;
    plLevels: null;
    preSell: boolean;
    realPayed: number;
    rightSource: number;
    rscl: null;
    sp: number;
    subp: number;
  };
}

interface NeteasePlaylistCreatorModel {
  userId: number;
  avatarUrl: string;
  nickname: string;
  signature: string;
}

interface NeteasePlaylistSummaryModel {
  coverImgUrl: string;
  createTime: number;
  description: Nullable<string>;
  creator: NeteasePlaylistCreatorModel;
  highQuality: boolean;
  id: number;
  name: string;
  playCount: number;
  privacy: number;
  subscribed: boolean;
  subscribedCount: number;
  tags: string[];
  trackCount: number;
  trackNumberUpdateTime: number;
  trackUpdateTime: number;
  updateTime: number;
  userId: number;
}

/** 一个歌词单词 */
interface LyricWord {
  /** 单词的起始时间，单位为毫秒 */
  startTime: number;
  /** 单词的结束时间，单位为毫秒 */
  endTime: number;
  /** 单词内容 */
  word: string;
  /** 是否为内嵌注释，比如日文汉字的平假名和片假名 */
  inlineNote?: boolean;
}

/** 一行歌词，存储多个单词 */
interface LyricLine {
  /**
   * 该行的所有单词
   * 如果是 LyRiC 等只能表达一行歌词的格式，这里就只会有一个单词且通常其始末时间和本结构的 `startTime` 和 `endTime` 相同
   */
  words: LyricWord[];
  /** 该行的翻译歌词，将会显示在主歌词行的下方 */
  translatedLyric: string;
  /** 该行的音译歌词，将会显示在翻译歌词行的下方 */
  romanLyric: string;
  /** 句子的起始时间，单位为毫秒 */
  startTime: number;
  /** 句子的结束时间，单位为毫秒 */
  endTime: number;
  /** 是否为空白行 */
  isBlank?: boolean;
  /** 是否为和声行 */
  isBackChorus?: boolean;
}

type NeteaseLyricModel = {
  data: LyricLine[];
  tips?: string;
  id?: number;
  rmExisted: boolean;
  tlExisted: boolean;
  noteExisted: boolean;
};

type NeteaseTrackRecordSourceType = "playlist" | "album" | "other" | "fm";
