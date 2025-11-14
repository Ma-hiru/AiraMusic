import request from "./utils/request";

/**
 * 获取 mv 数据
 * @desc 调用此接口 , 传入 mvid ( 在搜索音乐的时候传 type=1004 获得 ) , 可获取对应 MV 数据
 * @param mvid mv 的 id
 * @return 数据包含 mv 名字 , 歌手 , 发布时间 , mv 视频地址等数据
 * @note 其中 mv 视频 网易做了防盗链处理 , 可能不能直接播放 , 需要播放的话需要调用 `mvUrl` 接口
 * @example /mv/detail?mvid=5436712
 */
export function mvDetail(mvid: number) {
  return request({
    url: "/mv/detail",
    method: "get",
    params: {
      mvid,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * mv 地址
 * @desc 调用此接口 , 传入 mv id,可获取 mv 播放地址
 * @example /mv/url?id=5436712 /mv/url?id=10896407&r=1080
 */
export function mvUrl(params: {
  /** mv id */
  id: number;
  /** 分辨率,默认1080,可从 /mv/detail 接口获取分辨率列表 */
  r?: number;
}) {
  return request({
    url: "/mv/url",
    method: "get",
    params
  });
}

/**
 * 相似 mv
 * @desc 调用此接口 , 传入 mvid 可获取相似 mv
 * @param mvid mv id
 */
export function simiMv(mvid: number) {
  return request({
    url: "/simi/mv",
    method: "get",
    params: { mvid }
  });
}

/**
 * 收藏/取消收藏 MV
 * @desc 调用此接口,可收藏/取消收藏 MV
 */

export function likeAMV(params: {
  /** mv id */
  mvid: number;
  /** 1 为收藏,其他为取消收藏 */
  t?: number;
}) {
  return request({
    url: "/mv/sub",
    method: "post",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}
