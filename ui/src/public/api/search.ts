import { apiRequest } from "@mahiru/ui/public/api/request";
import { SearchType } from "@mahiru/ui/public/enum/search";

export default class _NeteaseSearchAPI {
  /**
   * 搜索
   * @desc 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户
   * @note 关键词可以多个 , 以空格隔开 , 如 " 周杰伦 搁浅 "( 不需要登录 ), 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接
   * */
  static search<T extends keyof NeteaseAPI.NeteaseSearchResultMap = any>(props: {
    /** 关键词,关键词可以多个,以空格隔开,如 " 周杰伦 搁浅 "*/
    keywords: string;
    /** 搜索类型 */
    type: SearchType;
    searchType?: "NORMAL" | "MORE";
    /** 返回数量 , 默认为 30 */
    limit?: number;
    /** 偏移数量，用于分页 , 如 : 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
    offset?: number;
  }) {
    const { keywords, type = SearchType.SOUND, searchType = "NORMAL", limit, offset } = props;
    const searchURL = searchType === "NORMAL" ? "/search" : "/cloudsearch";
    return apiRequest<any, NeteaseAPI.NeteaseSearchResultResponse<T>>({
      url: searchURL,
      params: { keywords, type, limit, offset }
    });
  }

  /**
   * 默认搜索关键词
   * @desc 默认搜索关键词
   * */
  static defaultKeywords() {
    return apiRequest<any, NeteaseAPI.NeteaseSearchDefaultKeywordsResponse>({
      url: "/search/default",
      params: { timestamp: Date.now() }
    });
  }

  /** 热搜列表(简略) */
  static hotListSummary() {
    return apiRequest("/search/hot");
  }

  /** 热搜列表(详细) */
  static hotListDetail() {
    return apiRequest<any, NeteaseAPI.NeteaseSearchHotListDetailResponse>("/search/hot/detail");
  }

  /** 搜索建议
   * @desc 调用此接口 , 传入搜索关键词可获得搜索建议 , 搜索结果同时包含单曲 , 歌手 , 歌单信息
   * */
  static suggest(keywords: string) {
    return apiRequest<any, NeteaseAPI.NeteaseSearchSuggestionResponse>({
      url: "/search/suggest",
      params: { keywords }
    });
  }

  /** 搜索多重匹配
   * @desc 调用此接口 , 传入搜索关键词可获得搜索结果
   * */
  static multiMatch(keywords: string) {
    return apiRequest({
      url: "/search/multimatch",
      params: { keywords }
    });
  }
}
