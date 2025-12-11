import { apiRequest } from "@mahiru/ui/utils/request";
import { CacheStore } from "@mahiru/ui/store";
import { Log } from "@mahiru/ui/utils/dev";
import { NeteaseBannerResponse } from "@mahiru/ui/types/netease/banner";
import { Time } from "@mahiru/ui/utils/time";

/**
 * 推荐歌单
 * @desc 调用此接口 , 可获取推荐歌单
 */
export async function recommendPlaylist(
  /** 取出数量 , 默认为 30 (不支持 offset) */
  limit?: number
): Promise<NeteaseRecommendPlaylistResponse> {
  const cacheKey = `personalized_${limit ?? 30}`;
  // 5分钟缓存
  const cache = await CacheStore.fetchObject<NeteaseRecommendPlaylistResponse>(
    cacheKey,
    1000 * 60 * 5
  );
  if (cache) {
    Log.trace("api/recommend.ts:recommendPlaylist", "使用推荐歌单缓存");
    return cache;
  }
  return await apiRequest<any, NeteaseRecommendPlaylistResponse>({
    url: "/personalized",
    method: "get",
    params: { limit, timestamp: Date.now() }
  }).then((result) => {
    Log.trace("api/recommend.ts:recommendPlaylist", "更新推荐歌单缓存");
    CacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 获取每日推荐歌单
 * @desc 调用此接口 , 可获得每日推荐歌单 ( 需要登录 )
 */
export async function dailyRecommendPlaylist(): Promise<NeteaseDailyRecommendPlaylistResponse> {
  const cacheKey = `recommend_resource`;
  const cache = await CacheStore.fetchObject<NeteaseDailyRecommendPlaylistResponse>(
    cacheKey,
    // 如果是新的一天则强制更新缓存,否则缓存24小时
    Time.isChangeDay() ? 0 : 1000 * 60 * 60 * 24
  );
  if (cache) {
    Log.trace("api/recommend.ts:dailyRecommendPlaylist", "使用推荐歌单缓存");
    return cache;
  }
  return await apiRequest<any, NeteaseDailyRecommendPlaylistResponse>({
    url: "/recommend/resource",
    method: "get",
    params: { timestamp: Date.now() }
  }).then((result) => {
    Log.trace("api/recommend.ts:dailyRecommendPlaylist", "更新推荐歌单缓存");
    CacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 每日推荐歌曲
 * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
 */
export async function dailyRecommendTracks(): Promise<NeteaseDailyRecommendTracksResponse> {
  const cacheKey = `recommend_songs`;
  const cache = await CacheStore.fetchObject<NeteaseDailyRecommendTracksResponse>(
    cacheKey,
    // 如果是新的一天则强制更新缓存,否则缓存24小时
    Time.isChangeDay() ? 0 : 1000 * 60 * 60 * 24
  );
  if (cache) {
    Log.trace("api/recommend.ts:dailyRecommendTracks", "使用推荐歌曲缓存");
    return cache;
  }
  return await apiRequest<any, NeteaseDailyRecommendTracksResponse>({
    url: "/recommend/songs",
    method: "get",
    params: { timestamp: Date.now() }
  }).then((result) => {
    Log.trace("api/recommend.ts:dailyRecommendTracks", "更新推荐歌曲缓存");
    CacheStore.storeObject(cacheKey, result);
    return result;
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
  return apiRequest({
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
  return apiRequest({
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
  return apiRequest({
    url: "/toplist",
    method: "get"
  });
}

/**
 * @desc 调用此接口 , 可获取 banner( 轮播图 ) 数据
 * @param type 资源类型,对应以下类型,默认为0 即 PC。
 *
 * 0: pc,1: android,2: iphone,3: ipad
 * */
export async function homeBanner(type: 0 | 1 | 2 | 3 = 0): Promise<NeteaseBannerResponse> {
  const cacheKey = `banner_${type}`;
  // 5分钟缓存
  const cache = await CacheStore.fetchObject<NeteaseBannerResponse>(cacheKey, 1000 * 60 * 5);
  if (cache) {
    Log.trace("api/recommend.ts:homeBanner", "使用 Banner 缓存");
    return cache;
  }
  return await apiRequest<any, NeteaseBannerResponse>({
    url: "/banner",
    method: "get",
    params: { type, timestamp: Date.now() }
  }).then((result) => {
    Log.trace("api/recommend.ts:homeBanner", "更新 Banner 缓存");
    CacheStore.storeObject(cacheKey, result);
    return result;
  });
}
