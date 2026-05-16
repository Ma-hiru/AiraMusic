/**
 * 搜索类型
 * */
export const enum SearchType {
  /** 单曲 */
  SONG = 1,
  /** 专辑 */
  ALBUM = 10,
  /** 歌手 */
  ARTIST = 100,
  /** 歌单 */
  PLAYLIST = 1000,
  /** 用户 */
  USER = 1002,
  /** MV */
  MV = 1004,
  /** 歌词 */
  LYRIC = 1006,
  /** 电台 */
  RADIO = 1009,
  /** 视频 */
  VIDEO = 1014,
  /** 综合 */
  COMPREHENSIVE = 1018,
  /** 声音(搜索声音返回字段格式会不一样) */
  SOUND = 2000
}
