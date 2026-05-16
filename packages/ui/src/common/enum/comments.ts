export const enum CommentType {
  /** 歌曲 */
  Song = 0,
  /** MV */
  MV = 1,
  /** 歌单 */
  Playlist = 2,
  /** 专辑 */
  Album = 3,
  /** 电台节目 */
  RadioProgram = 4,
  /** 视频 */
  Video = 5,
  /** 动态 */
  Event = 6,
  /** 电台 */
  Radio = 7
}

export enum CommentSort {
  Recommend = 1,
  Hot = 2,
  Time = 3
}

export const CommentSortText = {
  [CommentSort.Recommend]: "推荐",
  [CommentSort.Hot]: "最热",
  [CommentSort.Time]: "最新"
};
