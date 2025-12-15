import { apiRequest } from "@mahiru/ui/utils/request";

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
export async function getPlaylistDetail(
  id: number,
  update = false
): Promise<NeteasePlaylistDetailResponse> {
  return await apiRequest<{ id: number; timestamp: number }, NeteasePlaylistDetailResponse>({
    url: "/playlist/detail",
    method: "get",
    params: {
      id,
      timestamp: update ? new Date().getTime() : undefined
    }
  });
}

/**
 * 歌单分类
 * @desc 调用此接口,可获取歌单分类,包含 category 信息
 */
export function playlistCatlist() {
  return apiRequest<never, NeteasePlaylistCatlistResponse>({
    url: "/playlist/catlist",
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
  return apiRequest<any, NeteaseAPIResponse>("/playlist/subscribe", {
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
  return apiRequest<{ id: number }, NeteaseAPIResponse>({
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
  return apiRequest<typeof params & { timestamp: number }, NeteaseAPIResponse>({
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
  return apiRequest<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/playlist/tracks",
    method: "post",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 心动模式/智能播放
 * @desc 登录后调用此接口 , 可获取心动模式/智能播放列表 必选参数 : id :
 */
export function intelligencePlaylist(params: {
  /** 歌曲 id */
  id: number;
  /** 歌单 id */
  pid: number;
  /** 要开始播放的歌曲的 id (可选参数) */
  sid?: number;
}) {
  return apiRequest({
    url: "/playmode/intelligence/list",
    method: "get",
    params
  });
}

/**
 * 歌单收藏者
 * @desc 调用此接口 , 传入歌单 id 可获取歌单的所有收藏者
 * */
export function getPlaylistSubscribers(params: {
  /** 歌单id */
  id: number;
  /** 取出评论数量 , 默认为 20 */
  limit?: number;
  /** 偏移数量 , 用于分页 , 如 :( 评论页数 -1)*20, 其中 20 为 limit 的值 */
  offset?: number;
}) {
  return apiRequest<never, NeteaseAPIResponse>({ params });
}
