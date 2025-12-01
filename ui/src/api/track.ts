import request from "./utils/request";
import { usePersistZustandStore } from "../store";
import { Store } from "@mahiru/ui/store";
import { Log } from "@mahiru/ui/utils/dev";

type TrackDetailCacheResult = {
  songs: NeteaseTrack[];
  privileges: NeteaseTrackPrivilege[];
};

type TrackDetailResult = NeteaseTrackDetailResponse | TrackDetailCacheResult;

/**
 * 获取音乐 url
 * @desc 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,
 * @note 未登录状态返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
 * @param id - 音乐的 id，例如 id=405998841,33894312
 * @note 默认当返回的 quality >= 400000时，就会优先返回 hi-res
 */
export function getMP3(id: string | number) {
  const getBr = () => {
    // 当返回的 quality >= 400000时，就会优先返回 hi-res
    const { settings } = usePersistZustandStore.getState();
    const quality = settings?.musicQuality ?? "320000";
    return quality === "flac" ? "350000" : quality;
  };

  return request<any, NeteaseSongUrlResponse>({
    url: "/song/url",
    method: "get",
    params: {
      id,
      /** 码率,默认设置了 999000 即最大码率,如果要 320k 则可设置为 320000,其他类推 */
      br: getBr()
    }
  });
}

/**
 * 获取歌曲详情
 * @desc 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(注意:歌曲封面现在需要通过专辑内容接口获取)
 * @param ids - 音乐 id, 例如 ids=405998841,33894312
 * @example /song/detail?ids=347230`,`/song/detail?ids=347230,347231
 */
export async function getTrackDetail(ids: string | number): Promise<TrackDetailResult> {
  const url = `http://127.0.0.1:${import.meta.env.NCM_SERVER_PORT}/song/detail?ids=` + ids;
  const check = await Store.checkOrStoreAsync(url);
  if (check.ok) {
    Log.debug("ui/api/track.ts:getTrackDetail", "从本地缓存获取歌曲详情", ids);
    return await Store.fetch<TrackDetailResult>(url);
  }
  return request<{ ids: string | number }, NeteaseTrackDetailResponse>({
    url: "/song/detail",
    method: "get",
    params: {
      ids
    }
  });
}

/**
 * 获取歌词
 * @desc 调用此接口 , 传入音乐 id 可获得对应音乐的歌词 ( 不需要登录 )
 * @param id - 音乐 id
 */
export async function getLyric(id: number): Promise<NeteaseLyricResponse> {
  const url = `http://127.0.0.1:${import.meta.env.NCM_SERVER_PORT}/lyric?id=` + id;
  const check = await Store.checkOrStoreAsync(url);
  if (check.ok) {
    return await Store.fetch<NeteaseLyricResponse>(url);
  }
  return request<{ id: number }, NeteaseLyricResponse>({
    url: "/lyric",
    method: "get",
    params: {
      id
    }
  });
}

/**
 * 新歌速递
 * @desc 调用此接口 , 可获取新歌速递
 * @param type - 地区类型 id, 对应以下: 全部:0 华语:7 欧美:96 日本:8 韩国:16
 */
export function topSong(type: 0 | 7 | 96 | 8 | 16) {
  return request<{ type: number }, NeteaseTopSongResponse>({
    url: "/top/song",
    method: "get",
    params: {
      type
    }
  });
}

/**
 * 喜欢音乐
 * @desc 调用此接口 , 传入音乐 id, 可喜欢该音乐
 */
export function likeATrack(params: {
  /** 歌曲 id */
  id: number;
  /** 默认为 true 即喜欢 , 若传 false, 则取消喜欢 */
  like?: boolean;
}) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/like",
    method: "get",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 听歌打卡
 * @desc 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
 */
export function scrobble(params: {
  /** 歌曲 id */
  id: number;
  /** 歌单或专辑 id */
  sourceid: number;
  /** 歌曲播放时间,单位为秒 */
  time?: number;
}) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/scrobble",
    method: "get",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}
