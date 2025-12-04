import request from "./utils/request";
import { Store } from "@mahiru/ui/store";
import { IsChangeDay } from "@mahiru/ui/utils/time";
import { Log } from "@mahiru/ui/utils/dev";

/**
 * 推荐歌单
 * @desc 调用此接口 , 可获取推荐歌单
 */
export function recommendPlaylist(params: {
  /** 取出数量 , 默认为 30 (不支持 offset) */
  limit?: number;
}): Promise<NeteaseRecommendPlaylistResponse> {
  return request({
    url: "/personalized",
    method: "get",
    params
  });
}

/**
 * 获取每日推荐歌单
 * @desc 调用此接口 , 可获得每日推荐歌单 ( 需要登录 )
 */
export function dailyRecommendPlaylist(params: {
  limit?: number;
}): Promise<NeteaseDailyRecommendPlaylistResponse> {
  return request({
    url: "/recommend/resource",
    method: "get",
    params: {
      params,
      timestamp: Date.now()
    }
  });
}

/**
 * 获取精品歌单
 * @desc 调用此接口 , 可获取精品歌单
 */
export function highQualityPlaylist(params: {
  /** tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部", 可从精品歌单标签列表接口获取(/playlist/highquality/tags) */
  cat: string;
  /** 取出歌单数量 , 默认为 20 */
  limit?: number;
  /** 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据 */
  before: number;
}): Promise<NeteaseHighQualityPlaylistsResponse> {
  return request({
    url: "/top/playlist/highquality",
    method: "get",
    params
  });
}

/**
 * 歌单 ( 网友精选碟 )
 * @desc 调用此接口 , 可获取网友精选碟歌单
 */
export function topPlaylist(params: {
  /** 可选值为 'new' 和 'hot', 分别对应最新和最热 , 默认为 'hot' */
  order: "new" | "hot";
  /** tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部",可从歌单分类接口获取(/playlist/catlist) */
  cat: string;
  /** 取出歌单数量 , 默认为 50 */
  limit?: number;
}): Promise<NeteaseTopPlaylistResponse> {
  return request({
    url: "/top/playlist",
    method: "get",
    params
  });
}

/**
 * 所有榜单
 * @desc 调用此接口,可获取所有榜单 接口地址 : /toplist
 */
export function toplists() {
  return request({
    url: "/toplist",
    method: "get"
  });
}

/**
 * 每日推荐歌曲
 * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
 */
export async function dailyRecommendTracks(): Promise<NeteaseDailyRecommendTracksResponse> {
  let cache;
  if (IsChangeDay()) {
    cache = await Store.fetchObject<NeteaseDailyRecommendTracksResponse>("recommend_songs", 0); // 强制更新缓存
  } else {
    cache = await Store.fetchObject<NeteaseDailyRecommendTracksResponse>(
      "recommend_songs",
      1000 * 60 * 60 * 24
    ); // 24小时缓存
  }
  if (cache) {
    Log.trace("api/recommend.ts:dailyRecommendTracks", "使用推荐歌曲缓存");
    return cache;
  }
  return await request<any, NeteaseDailyRecommendTracksResponse>({
    url: "/recommend/songs",
    method: "get",
    params: { timestamp: new Date().getTime() }
  }).then((result) => {
    Log.trace("api/recommend.ts:dailyRecommendTracks", "更新推荐歌曲缓存");
    Store.storeObject("recommend_songs", result);
    return result;
  });
}
