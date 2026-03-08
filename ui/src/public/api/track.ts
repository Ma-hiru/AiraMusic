import { apiRequest } from "@mahiru/ui/public/api/request";
import { NeteaseMusicLevel } from "@mahiru/ui/public/enum/track";

export default class _NeteaseTrackAPI {
  /**
   * 获取音乐 url
   * @desc 使用歌单详情接口后 , 能得到的音乐的 id, 但不能得到的音乐 url, 调用此接口, 传入的音乐 id( 可多个 , 用逗号隔开 ), 可以获取对应的音乐的 url,
   * @note 未登录状态返回试听片段(返回字段包含被截取的正常歌曲的开始时间和结束时间)
   * @param id - 音乐的 id，例如 id=405998841,33894312
   * @param quality - 码率质量等级
   * @note 默认当返回的 `quality >= 400000` 时，就会优先返回 hi-res
   */
  url(id: string | number, quality?: NeteaseAPI.NeteaseQualityLevels) {
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
  urlNew(id: string | number, level: NeteaseMusicLevel, unblock = false) {
    return apiRequest<any, NeteaseMusicLevel>({
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
  detail(ids: string | number) {
    return apiRequest<any, NeteaseAPI.NeteaseTrackDetailResponse>({
      url: "/song/detail",
      params: { ids }
    });
  }

  /**
   * 喜欢音乐
   * @desc 调用此接口 , 传入音乐 id, 可喜欢该音乐
   */
  star(params: {
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
   * 听歌打卡
   * @desc 调用此接口 , 传入音乐 id, 来源 id，歌曲时间 time，更新听歌排行数据
   */
  scrobble(params: {
    /** 歌曲 id */
    id: number;
    /** 歌单或专辑 id */
    sourceid: number;
    /** 歌曲播放时间,单位为秒 */
    time?: number;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/scrobble",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 副歌时间
   * @desc 调用此接口, 传入歌曲 id, 获取副歌时间
   * */
  chorus(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseTrackChorusResponse>({
      url: "/song/chorus",
      params: { id }
    });
  }

  /**
   * 歌曲动态封面
   * @desc 登录后调用此接口, 传入歌曲 id, 获取歌曲动态封面
   * */
  dynamicCover(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/song/dynamic/cover",
      params: { id }
    });
  }

  /** 获取相似音乐 */
  similar(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/simi/song",
      params: { id }
    });
  }

  /**
   * 每日推荐歌曲
   * @desc 调用此接口 , 可获得每日推荐歌曲 ( 需要登录 )
   */
  recommendDaily() {
    return apiRequest<any, NeteaseAPI.NeteaseDailyRecommendTracksResponse>({
      url: "/recommend/songs",
      params: { timestamp: Date.now() }
    });
  }

  /**
   * 每日推荐歌曲-不感兴趣
   * @desc 日推歌曲标记为不感兴趣( 同时会返回一个新推荐歌曲, 需要登录 )
   * */
  recommendDailyTrash(id: number) {
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
  recommendNew(type: 0 | 7 | 96 | 8 | 16) {
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
  personalFM() {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
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
  personalFMTrash(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/fm_trash",
      params: {
        id,
        timestamp: Date.now()
      }
    });
  }
}
