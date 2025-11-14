import request from "@/utils/request";
import { mapTrackPlayableStatus } from "@/utils/common";
import { isAccountLoggedIn } from "@/utils/auth";
import { getTrackDetail } from "@/api/track";

/**
 * 获取歌手单曲
 * @desc 调用此接口 , 传入歌手 id, 可获得歌手部分信息和热门歌曲
 * @param id - 歌手 id, 可由搜索接口获得
 */
export function getArtist(id: number) {
  return request({
    url: "/artists",
    method: "get",
    params: {
      id,
      timestamp: new Date().getTime()
    }
  }).then(async (data) => {
    if (!isAccountLoggedIn()) {
      const trackIDs = data.hotSongs.map((t) => t.id);
      const tracks = await getTrackDetail(trackIDs.join(","));
      data.hotSongs = tracks.songs;
      return data;
    }
    data.hotSongs = mapTrackPlayableStatus(data.hotSongs);
    return data;
  });
}

/**
 * 获取歌手专辑
 * @desc 调用此接口 , 传入歌手 id, 可获得歌手专辑内容
 */
export function getArtistAlbum(params: {
  /** 歌手 id */
  id: number;
  /** 取出数量 , 默认为 50 */
  limit?: number;
  /** 偏移数量 , 用于分页 , 如 :( 页数 -1)*50, 其中 50 为 limit 的值 , 默认为 0 */
  offset?: number;
}) {
  params.limit ||= 50;
  params.offset ||= 0;
  return request({
    url: "/artist/album",
    method: "get",
    params
  });
}

/**
 * 排行榜中歌手地区枚举
 */
export const enum ArtistRegion {
  CHINESE = 1, // 华语
  WESTERN = 2, // 欧美
  KOREA = 3, // 韩国
  JAPAN = 4 // 日本
}

/**
 * 歌手榜
 * @desc 调用此接口，可获取排行榜中的歌手榜
 */
export function toplistOfArtists(type?: ArtistRegion) {
  return request({
    url: "/toplist/artist",
    method: "get",
    params: {
      type
    }
  });
}

/**
 * 获取歌手 mv
 * @desc 调用此接口 , 传入歌手 id, 可获得歌手 mv 信息
 * @desc 具体 mv 播放地址可调 用/mv传入此接口获得的 mvid 来拿到 ,
 * @example 如 : /artist/mv?id=6452,/mv?mvid=5461064
 */
export function artistMv(params: {
  /** 歌手 id, 可由搜索接口获得 */
  id: number;
  offset: number;
  limit: number;
}) {
  return request({
    url: "/artist/mv",
    method: "get",
    params
  });
}

/**
 * 收藏歌手
 * @desc 调用此接口 , 传入歌手 id, 可收藏歌手
 */
export function followAArtist(params: {
  /** 歌手 id */
  id: number;
  /** 操作,1 为收藏,其他为取消收藏 */
  t: number;
}) {
  return request({
    url: "/artist/sub",
    method: "post",
    params
  });
}

/**
 * 相似歌手
 * @desc 调用此接口 , 传入歌手 id, 可获得相似歌手
 * @param id 歌手 id
 */
export function similarArtists(id: number) {
  return request({
    url: "/simi/artist",
    method: "post",
    params: { id }
  });
}
