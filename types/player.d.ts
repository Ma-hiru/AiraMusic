interface NeteaseTrackModel extends NeteaseAPI.NeteaseTrackBase {
  al: NeteaseAPI.Al;
  ar: NeteaseAPI.Ar[];
  fee: 0 | 1 | 4 | 8;
  mv: number;
  no: number;
  originCoverType: 0 | 1 | 2;
  pop: number;
  publishTime: number;
  noCopyrightRcmd: any;
  privilege: NeteaseAPI.NeteaseTrackPrivilege;
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
}

type NeteaseLyricModel = {
  data: LyricLine[];
  rmActive?: boolean;
  tlActive?: boolean;
  tips?: string;
  rmExisted: boolean;
  tlExisted: boolean;
};
