import { apiRequest } from "@mahiru/ui/utils/request";

export enum CommentType {
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

export function getCommentNew(params: {
  /** 资源 id, 如歌曲 id,mv id */
  id: number;
  /** 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型 */
  type: CommentType;
  /** 分页参数,第 N 页,默认为 1 */
  pageNo: number;
  /** 分页参数,每页多少条数据,默认 20 */
  pageSize: number;
  /** 排序方式, 1:按推荐排序, 2:按热度排序, 3:按时间排序 */
  sortType: CommentSort;
  /** 当sortType为 3 时且页数不是第一页时需传入,值为上一条数据的 time */
  cursor?: number;
}) {
  return apiRequest("/comment/new", {
    params
  });
}
