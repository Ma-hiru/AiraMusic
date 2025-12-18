import { apiRequest } from "@mahiru/ui/utils/request";
import { CacheStoreErr, NCMServerErr } from "@mahiru/ui/utils/errs";
import { CacheStore } from "@mahiru/ui/store/cache";
import { Log } from "@mahiru/ui/utils/dev";
import { Time } from "@mahiru/ui/utils/time";

/**
 * 获取音乐 url
 * @desc 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,
 * @note 未登录状态返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
 * @param id - 音乐的 id，例如 id=405998841,33894312
 * @param quality - 码率质量等级
 * @note 默认当返回的 quality >= 400000时，就会优先返回 hi-res
 */
export async function getMP3(id: string | number, quality?: NeteaseQualityLevels) {
  try {
    return await apiRequest<any, NeteaseSongUrlResponse>({
      url: "/song/url",
      method: "get",
      params: {
        id,
        /** 码率,默认设置了 999000 即最大码率,如果要 320k 则可设置为 320000,其他类推 */
        br: quality?.br || 320000
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:getMP3", err);
  }
}

export const enum NeteaseMusicLevel {
  /**标准 */
  standard = "standard",
  /** 较高 */
  higher = "higher",
  /**极高 */
  exhigh = "exhigh",
  /** 无损 */
  lossless = "lossless",
  /** Hi-Res */
  hires = "hires",
  /** 高清环绕声 */
  jyeffect = "jyeffect",
  /** 沉浸环绕声 */
  sky = "sky",
  /** 杜比全景声 */
  dolby = "dolby",
  /** 超清母带 */
  jymaster = "jymaster"
}

/**
 * @desc 杜比全景声音质需要设备支持，不同的设备可能会返回不同码率的 url。
 * @note cookie 需要传入os=pc保证返回正常码率的 url。
 * @param id 音乐 id
 * @param level 播放音质等级
 * @param unblock 是否使用UnblockNeteaseMusic
 * */
export async function getMP3New(id: string | number, level: NeteaseMusicLevel, unblock = false) {
  try {
    return await apiRequest<any, NeteaseMusicLevel>("/song/url/v1", {
      method: "get",
      params: {
        id,
        level,
        unblock
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:getMP3New", err);
  }
}

/**
 * 获取歌曲详情
 * @desc 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(注意:歌曲封面现在需要通过专辑内容接口获取)
 * @param ids - 音乐 id, 例如 ids=405998841,33894312
 * @example /song/detail?ids=347230`,`/song/detail?ids=347230,347231
 */
export async function getTrackDetail(ids: string | number): Promise<NeteaseTrackDetailResponse> {
  const cacheID = `song_detail?ids=` + ids;
  try {
    const cache = await CacheStore.fetchObject<NeteaseTrackDetailResponse>(
      cacheID,
      Time.getCacheTimeLimit(24, "day")
    );
    if (cache) {
      Log.trace("api/track.ts:getTrackDetail", "使用歌曲详情缓存", ids);
      return cache;
    }
  } catch (err) {
    throw CacheStoreErr.create("ui/api/track.ts:getTrackDetail", err);
  }
  try {
    return await apiRequest<{ ids: string | number }, NeteaseTrackDetailResponse>({
      url: "/song/detail",
      method: "get",
      params: {
        ids
      }
    }).then((result) => {
      Log.trace("api/track.ts:getTrackDetail", "获取歌曲详情并缓存");
      try {
        void CacheStore.storeObject(cacheID, result);
      } catch (err) {
        Log.error(CacheStoreErr.create("ui/api/track.ts:getTrackDetail", err));
      }
      return result;
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:getTrackDetail", err);
  }
}

/**
 * 喜欢音乐
 * @desc 调用此接口 , 传入音乐 id, 可喜欢该音乐
 */
export async function likeATrack(params: {
  /** 歌曲 id */
  id: number;
  /** 默认为 true 即喜欢 , 若传 false, 则取消喜欢 */
  like?: boolean;
}) {
  try {
    return await apiRequest<typeof params & { timestamp: number }, NeteaseAPIResponse>({
      url: "/like",
      method: "get",
      params: {
        ...params,
        timestamp: new Date().getTime()
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:likeATrack", err);
  }
}

/**
 * 听歌打卡
 * @desc 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
 */
async function requestScrobble(params: {
  /** 歌曲 id */
  id: number;
  /** 歌单或专辑 id */
  sourceid: number;
  /** 歌曲播放时间,单位为秒 */
  time?: number;
}) {
  try {
    return await apiRequest<typeof params & { timestamp: number }, NeteaseAPIResponse>({
      url: "/scrobble",
      method: "get",
      params: {
        ...params,
        timestamp: new Date().getTime()
      }
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:scrobble", err);
  }
}

export function scrobble(lastStatus: PlayerTrackStatus, time: number) {
  const source = lastStatus?.source || lastStatus?.track?.al?.id;
  source &&
    requestScrobble({
      id: lastStatus.track.id,
      sourceid: source,
      time: Math.floor(time)
    });
}

/**
 * 副歌时间
 * @desc 调用此接口, 传入歌曲 id, 获取副歌时间
 * */
export async function getTrackChorus(id: number) {
  const cacheID = `song_chorus?id=` + id;
  try {
    const cache = await CacheStore.fetchObject<NeteaseTrackChorusResponse>(
      cacheID,
      Time.getCacheTimeLimit(7, "day")
    );
    if (cache) return cache;
  } catch (err) {
    throw CacheStoreErr.create("ui/api/track.ts:getTrackChorus", err);
  }
  try {
    return await apiRequest<any, NeteaseTrackChorusResponse>("/song/chorus", {
      params: { id }
    }).then((response) => {
      try {
        void CacheStore.storeObject(cacheID, response);
      } catch (err) {
        Log.error(CacheStoreErr.create("ui/api/track.ts:getTrackChorus", err));
      }
      return response;
    });
  } catch (err) {
    throw NCMServerErr.create("ui/api/track.ts:getTrackChorus", err);
  }
}

/**
 * 歌曲动态封面
 * @desc 登录后调用此接口, 传入歌曲 id, 获取歌曲动态封面
 * */
export function dynamicCover(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/song/dynamic/cover", { params: { id } });
}
