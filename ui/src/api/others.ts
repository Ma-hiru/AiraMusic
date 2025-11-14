import request from "./utils/request";
import { mapTrackPlayableStatus } from "./utils/common";
import type {
  NeteasePersonalFMResponse,
  NeteaseSearchSongResponse,
  NeteaseStatusResponse
} from "@mahiru/ui/types/netease-api";

/**
 * 搜索类型枚举
 * @desc 取值意义 : 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频, 1018:综合
 * */
export const enum SearchType {
  SINGLE = 1, // 单曲
  ALBUM = 10, // 专辑
  ARTIST = 100, // 歌手
  PLAYLIST = 1000, // 歌单
  USER = 1002, // 用户
  MV = 1004, // MV
  LYRICS = 1006, // 歌词
  RADIO = 1009, // 电台
  VIDEO = 1014, // 视频
  COMPREHENSIVE = 1018 // 综合
}

/**
 * 搜索
 * @desc 调用此接口 , 传入搜索关键词可以搜索该音乐 / 专辑 / 歌手 / 歌单 / 用户 , 关键词可以多个 , 以空格隔开 ,
 * @example 如 " 周杰伦 搁浅 "( 不需要登录 ), 搜索获取的 mp3url 不能直接用 , 可通过 /song/url 接口传入歌曲 id 获取具体的播放链接
 * @example /search?keywords=海阔天空 /cloudsearch?keywords=海阔天空(更全)
 */
export function search(params: {
  /** 关键词 */
  keywords: string;
  /** 返回数量 , 默认为 30 */
  limit?: number;
  /** 偏移数量，用于分页 , 如 : 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
  offset?: number;
  /** 搜索类型；默认为 1 即单曲 , 取值意义 : 1: 单曲, 10: 专辑, 100: 歌手, 1000: 歌单, 1002: 用户, 1004: MV, 1006: 歌词, 1009: 电台, 1014: 视频, 1018:综合 */
  type?: SearchType;
}) {
  return request<typeof params, NeteaseSearchSongResponse>({
    url: "/search",
    method: "get",
    params
  }).then((data) => {
    if (data.result?.song !== undefined)
      data.result.song.songs = mapTrackPlayableStatus(data.result.song.songs);
    return data;
  });
}

export function personalFM() {
  return request<{ timestamp: number }, NeteasePersonalFMResponse>({
    url: "/personal_fm",
    method: "get",
    params: {
      timestamp: new Date().getTime()
    }
  });
}

export function fmTrash(id: unknown) {
  return request<{ id: unknown; timestamp: number }, NeteaseStatusResponse>({
    url: "/fm_trash",
    method: "post",
    params: {
      timestamp: new Date().getTime(),
      id
    }
  });
}
