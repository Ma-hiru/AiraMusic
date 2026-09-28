export interface QQSinger {
  id?: number;
  mid?: string;
  name: string;
}

export interface QQSong {
  id: number;
  mid: string;
  title: string;
  interval?: number;
  singer: QQSinger[];
  album?: {
    id?: number;
    mid?: string;
    name?: string;
  };
}

/** 旧版搜索返回扁平字段，需要转换为 QQSong */
export interface QQLegacySong {
  songid: number;
  albumid: number;
  songmid: string;
  albummid: string;
  interval: number;
  songname: string;
  albumname: string;
  singer: QQSinger[];
}

export interface QQLegacySearchResponse {
  code: number;
  message?: string;
  data?: {
    song?: {
      curnum: number;
      curpage: number;
      totalnum: number;
      list: QQLegacySong[];
    };
  };
}

/** musicu 的顶层成功状态与各模块的状态是独立的 */
export type QQMusicuResponse<K extends string, T> = Partial<
  Record<K, { data?: T; code: number }>
> & {
  ts?: number;
  code: number;
  traceid?: string;
  start_ts?: number;
};

export interface QQSearchData {
  code: number;
  body?: {
    song?: { list: QQSong[] };
  };
}

export type QQSearchResponse = QQMusicuResponse<"music.search.SearchCgiService", QQSearchData>;

/** GetPlayLyricInfo 实测响应；track 是占位曲目，singer 可以为 null */
export interface QQLyricData {
  qrc: number;
  roma: string;
  crypt: number;
  lrc_t: number;
  lyric: string;
  qrc_t: number;
  trans: string;
  roma_t: number;
  songID: number;
  startTs: number;
  trans_t: number;
  lt_lyric: string;
  songName: string;
  songType: number;
  classical: number;
  lt_lyric_t: number;
  singerName: string;
  lyric_style: number;
  transSource: number;
  hasMultiTrans: boolean;
  introduceTitle: string;
  hasContributor: boolean;
  hasTransContributor: boolean;
  singingAnnotationsTs: number;
  singingAnnotationsLyric: string;
  introduceText: { title: string; content: string }[];
  track: Omit<QQSong, "singer"> & { singer: null | QQSinger[] };
  // 实测为 null，非空结构尚未确认
  vecSongID: JsonValue;
}

export type QQLyricResponse = QQMusicuResponse<"lyric", QQLyricData>;

/** 解密后的单份歌词；unknown 表示不能确认格式，不应交给时轴解析器。 */
export interface QQLyricContent {
  text: string;
  type: "lrc" | "qrc" | "unknown";
}

export interface QQLyricResult {
  raw: QQLyricData;
  /** 空歌词为 null；三份歌词分别判断格式。 */
  roma: null | QQLyricContent;
  lyric: null | QQLyricContent;
  translation: null | QQLyricContent;
}

export interface QQSongMatch {
  song: QQSong;
  score: number;
}
