import { apiRequest } from "@mahiru/ui/utils/request";

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

/**
 * 搜索
 * @desc 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户
 * @note 关键词可以多个 , 以空格隔开 , 如 " 周杰伦 搁浅 "( 不需要登录 ), 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接
 * */
export function search(props: {
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
  const { keywords, type = SearchType.SOUND, searchType = "MORE", limit, offset } = props;
  const searchURL = searchType === "NORMAL" ? "/search" : "/cloudsearch";
  return apiRequest(searchURL, { params: { keywords, type, limit, offset } });
}

/** 热搜列表(简略) */
export function searchHotListSummary() {
  return apiRequest("/search/hot");
}

/** 热搜列表(详细) */
export function searchHotListDetail() {
  return apiRequest("/search/hot/detail");
}

/** 搜索建议
 * @desc 调用此接口 , 传入搜索关键词可获得搜索建议 , 搜索结果同时包含单曲 , 歌手 , 歌单信息
 * */
export function searchSuggest(keywords: string) {
  return apiRequest("/search/suggest", { params: { keywords } });
}

/** 搜索多重匹配
 * @desc 调用此接口 , 传入搜索关键词可获得搜索结果
 * */
export function searchMultimatch(keywords: string) {
  return apiRequest("/search/multimatch", { params: { keywords } });
}
