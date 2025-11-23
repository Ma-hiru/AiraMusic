/** 一个歌词单词 */
interface LyricWord {
  /** 单词的起始时间，单位为毫秒 */
  startTime: number;
  /** 单词的结束时间，单位为毫秒 */
  endTime: number;
  /** 单词内容 */
  word: string;
  /** 单词的音译内容 */
  romanWord: string;
  /** 单词内容是否包含冒犯性的不雅用语 */
  obscene: boolean;
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
  /** 该行是否为背景歌词行，当该行歌词的上一句非背景歌词被激活时，这行歌词将会显示出来，注意每个非背景歌词下方只能拥有一个背景歌词 */
  isBG: boolean;
  /** 该行是否为对唱歌词行（即歌词行靠右对齐） */
  isDuet: boolean;
}

type FullVersionLyricLine = {
  full: LyricLine[];
  raw: LyricLine[];
  tl: LyricLine[];
  rm: LyricLine[];
};

type LyricVersionType = "raw" | "full" | "tl" | "rm";

type LyricInit = {
  lyricLines: FullVersionLyricLine;
  info: {
    id: number;
    title: string;
    artist: Array<{ alias: string[]; id: number; name: string; tns: string[] }>;
    album: {
      id: number;
      name: string;
      pic: number;
      pic_str?: string;
      picUrl: string;
      tns: string[];
    };
    cover: string;
    audio: string;
  };
};

type LyricSync = {
  currentTime: number;
  duration: number;
  lyricVersion: LyricVersionType;
  isPlaying: boolean;
};
