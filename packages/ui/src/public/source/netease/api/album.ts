import { apiRequest } from "@mahiru/ui/public/source/netease/api/request";

export default class _NeteaseAlbumAPI {
  /**
   * 获取专辑内容
   * @param id 专辑 id
   */
  static content(id: number) {
    return apiRequest<{ id: number }, NeteaseAPI.NeteaseAlbumContentResponse>({
      url: "/album",
      method: "get",
      params: {
        id
      }
    });
  }

  /**
   * 全部新碟
   * @desc 登录后调用此接口 ,可获取全部新碟
   */
  static allNews(params: {
    /** 返回数量 , 默认为 30 */
    limit?: number;
    /** 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
    offset?: number;
    /** ALL:全部,ZH:华语,EA:欧美,KR:韩国,JP:日本 */
    area?: "ALL" | "ZH" | "EA" | "KR" | "JP";
  }) {
    return apiRequest({
      url: "/album/new",
      method: "get",
      params
    });
  }

  /**
   * 专辑动态信息
   * @desc 调用此接口 , 传入专辑 id, 可获得专辑动态信息,如是否收藏,收藏数,评论数,分享数
   * @param id 专辑id
   */
  static detail(id: number) {
    return apiRequest<
      { id: number; timestamp: number },
      NeteaseAPI.NeteaseAlbumDynamicDetailResponse
    >({
      url: "/album/detail/dynamic",
      method: "get",
      params: { id, timestamp: Date.now() }
    });
  }

  /**
   * 收藏/取消收藏专辑
   * @desc 调用此接口,可 收藏/取消收藏 专辑
   */
  static star(params: {
    /** 返专辑 id */
    id: number;
    /** 1 为收藏,其他为取消收藏 */
    t: 1 | 0;
  }) {
    return apiRequest<typeof params, NeteaseAPI.NeteaseAPIResponse>({
      url: "/album/sub",
      method: "post",
      params
    });
  }
}
