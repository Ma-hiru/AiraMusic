import request from "./utils/request";
import { mapTrackPlayableStatus } from "./utils/common";
import type {
  NeteaseDailySongsResponse,
  NeteasePlaylistDetailResponse,
  NeteaseStatusResponse
} from "@mahiru/ui/types/netease-api";
import { cacheCheck, cacheFetch, cacheStore } from "@mahiru/ui/utils/cache";

/**
 * 推荐歌单
 * @desc 调用此接口 , 可获取推荐歌单
 * @example /personalized?limit=1
 */
// TODO: `/personalized` 返回体包含 result/category，后续可补类型
export function recommendPlaylist(params: {
  /** 取出数量 , 默认为 30 (不支持 offset) */
  limit?: number;
}) {
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
// TODO: `/recommend/resource` 返回字段较多，暂未建立类型
export function dailyRecommendPlaylist(params: { limit?: number }) {
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
 * 获取歌单详情
 * @desc 歌单能看到歌单名字, 但看不到具体歌单内容 , 调用此接口 , 传入歌单 id, 可以获取对应歌单内的所有的音乐(未登录状态只能获取不完整的歌单,登录后是完整的)，
 * @return 返回的trackIds是完整的，tracks 则是不完整的，可拿全部 trackIds 请求一次 song/detail 接口
 * 获取所有歌曲的详情 (https://github.com/Binaryify/NeteaseCloudMusicApi/issues/452)
 * - s : 歌单最近的 s 个收藏者, 默认为8
 * @param  id 歌单 id
 * @param time_limit
 * @param update
 */
export async function getPlaylistDetail(id: number, update = false) {
  const url = "http://127.0.0.1:10754/playlist/detail?id=" + id;
  const result = await cacheCheck(id);
  if (result.ok) {
    console.log("playlist detail from cache=>", id);
    const data = await cacheFetch(id).then((res) => res.json());
    if (data.playlist) {
      data.playlist.tracks = mapTrackPlayableStatus(data.playlist.tracks, data.privileges || []);
    }
    return data;
  } else {
    console.log("playlist detail store cache=>", id);
    cacheStore(id, url).catch((err) => console.log(err));
  }
  console.log("playlist detail from net=>", id);
  const data = await request<{ id: number; timestamp: number }, NeteasePlaylistDetailResponse>({
    url: "/playlist/detail",
    method: "get",
    params: {
      id,
      timestamp: update ? new Date().getTime() : undefined
    }
  });
  if (data.playlist) {
    data.playlist.tracks = mapTrackPlayableStatus(data.playlist.tracks, data.privileges || []);
  }
  return data;
}

/**
 * 获取精品歌单
 * @desc 调用此接口 , 可获取精品歌单
 */
// TODO: `/top/playlist/highquality` 返回内容较大，待补类型
export function highQualityPlaylist(params: {
  /** tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部", 可从精品歌单标签列表接口获取(/playlist/highquality/tags) */
  cat: string;
  /** 取出歌单数量 , 默认为 20 */
  limit?: number;
  /** 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据 */
  before: number;
}) {
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
// TODO: `/top/playlist` 返回结构与精选歌单类似，待补类型
export function topPlaylist(params: {
  /** 可选值为 'new' 和 'hot', 分别对应最新和最热 , 默认为 'hot' */
  order: "new" | "hot";
  /** tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部",可从歌单分类接口获取(/playlist/catlist) */
  cat: string;
  /** 取出歌单数量 , 默认为 50 */
  limit?: number;
}) {
  return request({
    url: "/top/playlist",
    method: "get",
    params
  });
}

/**
 * 歌单分类
 * @desc 调用此接口,可获取歌单分类,包含 category 信息
 */
// TODO: `/playlist/catlist` 返回 categories/ sub 类别，待补类型
export function playlistCatlist() {
  return request({
    url: "/playlist/catlist",
    method: "get"
  });
}

/**
 * 所有榜单
 * @desc 调用此接口,可获取所有榜单 接口地址 : /toplist
 */
// TODO: `/toplist` 返回多个榜单详情，待补类型
export function toplists() {
  return request({
    url: "/toplist",
    method: "get"
  });
}

/**
 * 收藏/取消收藏歌单
 * @desc 调用此接口, 传入类型和歌单 id 可收藏歌单或者取消收藏歌单
 */
export function subscribePlaylist(params: {
  /** 歌单 id */
  id: number;
  /** 类型,`1:收藏`,`2:取消收藏` */
  t: 1 | 2;
}) {
  return request<typeof params & { timestamp: number }, NeteaseStatusResponse>({
    url: "/playlist/subscribe",
    method: "post",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 删除歌单
 * @desc 调用此接口 , 传入歌单id可删除歌单
 * @param id 歌单id,可多个,用逗号隔开
 */
export function deletePlaylist(id: number) {
  return request<{ id: number }, NeteaseStatusResponse>({
    url: "/playlist/delete",
    method: "post",
    params: { id }
  });
}

/**
 * 新建歌单
 * @desc 调用此接口 , 传入歌单名字可新建歌单
 */
export function createPlaylist(params: {
  /** 歌单名 */
  name: string;
  /** 是否设置为隐私歌单，默认否，传`10`则设置成隐私歌单 */
  privacy?: 10;
  /** 歌单类型,默认`NORMAL`,传 `VIDEO`则为视频歌单 */
  type?: "NORMAL" | "VIDEO";
}) {
  return request<typeof params & { timestamp: number }, NeteaseStatusResponse>({
    url: "/playlist/create",
    method: "post",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 对歌单添加或删除歌曲
 * @desc 调用此接口 , 可以添加歌曲到歌单或者从歌单删除某首歌曲 ( 需要登录 )
 */
export function addOrRemoveTrackFromPlaylist(params: {
  /** 从歌单增加单曲为 `add`, 删除为 `del` */
  op: "add" | "del";
  /** 歌单 id */
  pid: number;
  /** 歌曲 id,可多个,用逗号隔开 */
  tracks: number | string;
}) {
  return request<typeof params & { timestamp: number }, NeteaseStatusResponse>({
    url: "/playlist/tracks",
    method: "post",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 每日推荐歌曲
 * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
 */
export function dailyRecommendTracks() {
  return request<{ timestamp: number }, NeteaseDailySongsResponse>({
    url: "/recommend/songs",
    method: "get",
    params: { timestamp: new Date().getTime() }
  }).then((result) => {
    result.data.dailySongs = mapTrackPlayableStatus(result.data.dailySongs, result.data.privileges);
    return result;
  });
}

/**
 * 心动模式/智能播放
 * @desc 登录后调用此接口 , 可获取心动模式/智能播放列表 必选参数 : id :
 */
// TODO: `/playmode/intelligence/list` 返回推荐队列，待补类型
export function intelligencePlaylist(params: {
  /** 歌曲 id */
  id: number;
  /** 歌单 id */
  pid: number;
  /** 要开始播放的歌曲的 id (可选参数) */
  sid?: number;
}) {
  return request({
    url: "/playmode/intelligence/list",
    method: "get",
    params
  });
}
