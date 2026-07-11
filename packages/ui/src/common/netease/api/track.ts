import { NeteaseMusicLevel } from "@/common/enum";
import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseTrackAPI {
  /**
   * 获取音乐 url
   * @desc 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,
   * @note 未登录状态返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
   * @param id - 音乐的 id，例如 id=405998841,33894312
   * @param quality - 码率质量等级
   * @note 默认当返回的 `quality >= 400000` 时，就会优先返回 hi-res
   */
  static url(id: number | string, quality?: NeteaseAPI.NeteaseQualityLevels) {
    return apiRequest<any, NeteaseAPI.NeteaseSongUrlResponse>({
      url: "/song/url",
      params: {
        id,
        /** 码率,默认设置了 999000 即最大码率,如果要 320k 则可设置为 320000,其他类推 */
        br: quality?.br || 320000
      }
    });
  }

  /**
   * @desc 杜比全景声音质需要设备支持，不同的设备可能会返回不同码率的 url。
   * @note cookie 需要传入os=pc保证返回正常码率的 url。
   * @param id 音乐 id
   * @param level 播放音质等级
   * @param unblock 是否使用UnblockNeteaseMusic
   * */
  static urlNew(id: number | string, level: NeteaseMusicLevel, unblock = false) {
    return apiRequest<any, NeteaseAPI.NeteaseSongUrlNewResponse>({
      url: "/song/url/v1",
      params: {
        id,
        level,
        unblock
      }
    });
  }

  /**
   * 获取歌曲详情
   * @desc 调用此接口 , 传入音乐 id(支持多个 id, 用 , 隔开), 可获得歌曲详情(注意:歌曲封面现在需要通过专辑内容接口获取)
   * @param ids - 音乐 id, 例如 ids=405998841,33894312
   * @example /song/detail?ids=347230`,`/song/detail?ids=347230,347231
   */
  static detail(ids: number | string | number[]) {
    if (Array.isArray(ids)) ids = ids.join(",");
    return apiRequest<any, NeteaseAPI.NeteaseTrackDetailResponse>({
      method: "POST",
      url: "/song/detail",
      data: { ids }
    });
  }

  /**
   * 喜欢音乐
   * @desc 调用此接口 , 传入音乐 id, 可喜欢该音乐
   */
  static star(params: {
    /** 歌曲 id */
    id: number;
    /** 默认为 true 即喜欢 , 若传 false, 则取消喜欢 */
    like?: boolean;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/like",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 听歌打卡 v2 NCBL加密版
   * @desc 调用此接口，使用桌面客户端 NCBL 加密日志格式上报听歌记录
   */
  static scrobbleV2(params: {
    /** 歌曲 id */
    id: number;
    /** 歌曲播放时间，单位为秒 */
    time: number;
    /** 来源列表 id */
    sourceid?: number;
    /** 来源名称(默认 list) */
    source?: string;
    /** 歌曲名 */
    name?: string;
    /** 艺术家 */
    artist?: string;
    /** 码率(默认 320) */
    bitrate?: number;
    /** 音质等级(默认 exhigh) */
    level?: string;
    /**  歌曲总时长(秒) */
    total?: number;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/scrobble/v1",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  static stateSubmit(params: {
    /** 歌曲 id */
    id: number;
    /** 播放进度（秒），默认 0 */
    progress: number;
    /** 播放会话 ID（12 位大写字母和数字），不传则自动生成 */
    sessionId?: string;
    playMode?: "list_loop";
    /** 资源类型，默认 song */
    type?: "song";
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/relay/play/state/submit",
      params: { ...params, timestamp: Date.now() }
    });
  }

  /**
   * 副歌时间
   * @desc 调用此接口, 传入歌曲 id, 获取副歌时间
   * */
  static chorus(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseTrackChorusResponse>({
      url: "/song/chorus",
      params: { id }
    });
  }

  /**
   * 歌曲动态封面
   * @desc 登录后调用此接口, 传入歌曲 id, 获取歌曲动态封面
   * */
  static dynamicCover(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/song/dynamic/cover",
      params: { id }
    });
  }

  /** 获取相似音乐 */
  static similar(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/simi/song",
      params: { id }
    });
  }

  /**
   * 每日推荐歌曲
   * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
   */
  static recommendDaily() {
    return apiRequest<any, NeteaseAPI.NeteaseDailyRecommendTracksResponse>({
      url: "/recommend/songs",
      params: { timestamp: Date.now() }
    });
  }

  /**
   * 每日推荐歌曲-不感兴趣
   * @desc 日推歌曲标记为不感兴趣( 同时会返回一个新推荐歌曲, 需要登录 )
   * */
  static recommendDailyTrash(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/recommend/songs/dislike",
      params: { id, timestamp: Date.now() }
    });
  }

  /**
   * 新歌速递
   * @desc 调用此接口 , 可获取新歌速递
   * @param type - 地区类型 id, 对应以下: 全部:0 华语:7 欧美:96 日本:8 韩国:16
   */
  static recommendNew(type: 0 | 7 | 8 | 16 | 96) {
    return apiRequest<any, NeteaseAPI.NeteaseTopSongResponse>({
      url: "/top/song",
      params: {
        type
      }
    });
  }

  /**
   * 私人 FM
   * @note 需要登录
   * */
  static personalFM() {
    return apiRequest<any, NeteaseAPI.NeteasePersonalFMResponse>({
      url: "/personal_fm",
      params: {
        timestamp: Date.now()
      }
    });
  }

  /**
   * 私人FM垃圾桶
   * @desc 调用此接口 , 传入音乐 id, 可把该音乐从私人 FM 中移除至垃圾桶
   * */
  static personalFMTrash(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/fm/trash",
      params: {
        id,
        timestamp: Date.now()
      }
    });
  }

  static redCount(id: number) {
    return apiRequest<
      any,
      NeteaseAPI.NeteaseAPIResponse & {
        data: {
          count: number;
          countDesc: string;
        };
      }
    >({
      url: "/song/red/count",
      params: {
        id,
        timestamp: Date.now()
      }
    });
  }
}
