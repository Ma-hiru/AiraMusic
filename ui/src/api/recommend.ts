import { apiRequest } from "@mahiru/ui/utils/request";
import { Log } from "@mahiru/ui/utils/dev";
import { NeteaseBannerResponse } from "@mahiru/ui/types/netease/banner";
import { Time } from "@mahiru/ui/utils/time";
import { NCMServerErr } from "@mahiru/ui/utils/errs";
import { StoreSnapshot } from "@mahiru/ui/store/snapshot";

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
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseRecommendPlaylistResponse>(
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
    StoreSnapshot.cacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 获取每日推荐歌单
 * @desc 调用此接口 , 可获得每日推荐歌单 ( 需要登录 )
 */
export async function dailyRecommendPlaylist(): Promise<NeteaseDailyRecommendPlaylistResponse> {
  const cacheKey = `recommend_resource`;
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseDailyRecommendPlaylistResponse>(
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
    StoreSnapshot.cacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 每日推荐歌曲
 * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
 */
export async function dailyRecommendTracks(): Promise<NeteaseDailyRecommendTracksResponse> {
  const cacheKey = `recommend_songs`;
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseDailyRecommendTracksResponse>(
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
    StoreSnapshot.cacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 每日推荐歌曲-不感兴趣
 * @desc 日推歌曲标记为不感兴趣( 同时会返回一个新推荐歌曲, 需要登录 )
 * */
export async function dailyRecommendTracksTrash(id: number) {
  return apiRequest("/recommend/songs/dislike", { params: { id, timestamp: Date.now() } });
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
  const cache = await StoreSnapshot.cacheStore.fetchObject<NeteaseBannerResponse>(
    cacheKey,
    1000 * 60 * 5
  );
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
    StoreSnapshot.cacheStore.storeObject(cacheKey, result);
    return result;
  });
}

/**
 * 新歌速递
 * @desc 调用此接口 , 可获取新歌速递
 * @param type - 地区类型 id, 对应以下: 全部:0 华语:7 欧美:96 日本:8 韩国:16
 */
export async function topSong(type: 0 | 7 | 96 | 8 | 16) {
  try {
    return await apiRequest<any, NeteaseTopSongResponse>({
      url: "/top/song",
      method: "get",
      params: {
        type
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:topSong", err);
  }
}

/**
 * 私人 FM
 * @note 需要登录
 * */
export function personalFM() {
  return apiRequest<any, NeteaseAPIResponse>("/personal_fm", {
    params: {
      timestamp: Date.now()
    }
  });
}

/**
 * 私人FM垃圾桶
 * @desc 调用此接口 , 传入音乐 id, 可把该音乐从私人 FM 中移除至垃圾桶
 * */
export function fmTrash(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/fm_trash", {
    params: {
      timestamp: Date.now(),
      id
    }
  });
}

/**
 *  相关歌单推荐
 * @desc 调用此接口, 传入歌单 id, 获取相关歌单推荐
 * */
export function relativePlaylist(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/playlist/detail/rcmd/get", {
    params: { id }
  });
}
