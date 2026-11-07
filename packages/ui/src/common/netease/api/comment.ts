import { CommentSort, CommentType } from "@/common/enum";
import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseCommentAPI {
  static get(
    params: {
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
      /** 是否使用缓存 */
      cache?: boolean;
    },
    signal?: AbortSignal
  ) {
    return apiRequest<any, NeteaseAPI.NeteaseCommentsNewResponse>("/comment/new", {
      params: {
        ...params,
        timestamp: params.cache ? undefined : Date.now()
      },
      signal
    });
  }

  static floor(
    params: {
      /** 资源 id, 如歌曲 id,mv id */
      id: number;
      /** 楼层评论 id */
      parentCommentId: number;
      /** 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型 */
      type: CommentType;
      /** 取出评论数量, 默认为 20 */
      limit?: number;
      /** 分页参数,取上一页最后一项的 time 获取下一页数据 */
      time?: number;
    },
    signal?: AbortSignal
  ) {
    return apiRequest<any, NeteaseAPI.NeteaseCommentFloorResponse>({
      url: "/comment/floor",
      params,
      signal
    });
  }

  /**
   * @desc 调用此接口, 传入资源类型和资源 id 列表, 可批量获取对应资源的评论统计数据 (不需要登录)
   * @return
   * ```json
   * {
   *   "data": [
   *     {
   *       "latestLikedUsers": null,
   *       "liked": false,
   *       "comments": null,
   *       "resourceType": 4,
   *       "resourceId": 186016,
   *       "commentUpgraded": false,
   *       "musicianSaidCount": 0,
   *       "commentCountDesc": "100w+",
   *       "likedCount": 347,
   *       "commentCount": 1970844,
   *       "shareCount": 109721,
   *       "threadId": "R_SO_4_186016"
   *     }
   *   ],
   *   "code": 200
   * }
   * ```
   * */
  static info(
    params: {
      /** 资源 id 列表 */
      ids: number[];
      /** 数字 , 资源类型 , 对应歌曲 , mv, 专辑 , 歌单 , 电台, 视频对应以下类型 */
      type: CommentType;
    },
    signal?: AbortSignal
  ) {
    return apiRequest<unknown, NeteaseAPI.NeteaseCommentInfoResponse>({
      url: "/comment/info/list",
      params: {
        ids: params.ids.join(","),
        type: params.type,
        timestamp: Date.now()
      },
      signal
    });
  }

  /**
   * 给评论点赞
   * @desc 调用此接口 , 传入 type, 资源 id, 和评论 id cid 和 是否点赞参数 t 即可给对 应评论点赞 ( 需要登录 )
   @note 动态点赞不需要传入 id 参数，需要传入动态的 threadId 参数
   * */
  static like(
    params: {
      /** 评论 id */
      cid?: number;
      /** 是否点赞 , 1 为点赞 ,0 为取消点赞 */
      t: 0 | 1;
      type: CommentType;
      /** 资源 id, 如歌曲 id,mv id */
      id: number;
      threadId?: string;
    },
    signal?: AbortSignal
  ) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>("/comment/like", {
      params: {
        ...params,
        timestamp: Date.now()
      },
      signal
    });
  }

  /**
   * 抱一抱评论
   * @desc 调用此接口,可抱一抱评论
   * */
  static hug(params: {
    /** 用户 id */
    uid: number;
    /** 评论 id */
    cid: number;
    /** 资源 id */
    sid: number;
  }) {
    return apiRequest("/hug/comment", { params });
  }

  /**
   * 发送/删除评论
   * @desc 调用此接口,可发送评论或者删除评论
   * @note 给动态发送评论，则不需要传 id，需要传动态的 threadId
   * @note 给动态删除评论，则不需要传 id，需要传动态的 threadId
   * @example /comment?t=1&type=6&threadId=A_EV_2_6559519868_32953014&content=test
   * */
  static send(
    params:
      | {
          /** :0 删除 */
          t: 0;
          type: CommentType;
          /** 对应资源 id */
          id: number;
          /** 评论id */
          commentId?: number;
          /** 给动态删除评论，则不需要传 id，需要传动态的 threadId */
          threadId?: string;
        }
      | {
          type: CommentType;
          /** 1 发送, 2 回复 */
          t: 1 | 2;
          /** 对应资源 id */
          id: number;
          /** 要发送的内容 */
          content: string;
          /** 回复的评论 id (回复评论时必填) */
          commentId?: number;
          /** 给动态发送评论，则不需要传 id，需要传动态的 threadId */
          threadId?: string;
        },
    signal?: AbortSignal
  ) {
    return apiRequest("/comment", { params, signal });
  }
}
