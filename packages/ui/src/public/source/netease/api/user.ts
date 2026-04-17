import { apiRequest } from "@mahiru/ui/public/source/netease/api/request";

export default class _NeteaseUserAPI {
  /**
   * 获取用户详情
   * @desc 登录后调用此接口 , 传入用户 id, 可以获取用户详情
   * @param uid 用户 id
   */
  static detail(uid: number) {
    return apiRequest<any, NeteaseAPI.NeteaseUserDetailResponse>({
      url: "/user/detail",
      params: {
        uid,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取账号详情
   * @desc 登录后调用此接口 ,可获取用户账号信息
   */
  static account() {
    return apiRequest<any, NeteaseAPI.NeteaseUserAccountResponse>({
      url: "/user/account",
      params: {
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取用户歌单
   * @desc 登录后调用此接口 , 传入用户 id, 可以获取用户歌单
   */
  static playlist(params: {
    /** 用户 id */
    uid: number;
    /** 返回数量 , 默认为 30 */
    limit: number;
    /** 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
    offset?: number;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseUserPlaylistResponse>({
      url: "/user/playlist",
      params
    });
  }

  /**
   * 获取用户播放记录
   * @desc 登录后调用此接口 , 传入用户 id, 可获取用户播放记录
   */
  static playHistory(params: {
    /** 用户 id */
    uid: number;
    /** type=1 时只返回 weekData, type=0 时返回 allData */
    type: 1 | 0;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/user/record",
      params
    });
  }

  /**
   * 喜欢音乐列表（需要登录）
   * @desc 调用此接口 , 传入用户 id, 可获取已喜欢音乐id列表(id数组)
   * @param uid 用户 id
   */
  static likedTracks(uid: number) {
    return apiRequest<any, NeteaseAPI.NeteaseLikedSongIdsResponse>({
      url: "/likelist",
      params: {
        uid,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 每日签到
   * @desc 调用此接口可签到获取积分
   * @param type 签到类型 , 默认 0, 其中 0 为安卓端签到 ,1 为 web/PC 签到
   */
  static dailySignin(type: 0 | 1 = 0) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/daily_signin",
      method: "post",
      params: {
        type,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取收藏的专辑（需要登录）
   * @desc 调用此接口可获取到用户收藏的专辑
   */
  static likedAlbums(params: {
    /** 返回数量 , 默认为 25 */
    limit: number;
    /** 偏移数量，用于分页 , 如 :( 页数 -1)*25, 其中 25 为 limit 的值 , 默认为 0 */
    offset?: number;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/album/sublist",
      params: {
        ...params,
        timestamp: new Date().getTime()
      }
    });
  }

  /**
   * 获取收藏的歌手（需要登录）
   * @desc 调用此接口可获取到用户收藏的歌手
   */
  static likedArtists(params: { limit: number; offset?: number }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/artist/sublist",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 获取收藏的MV（需要登录）
   * @desc 调用此接口可获取到用户收藏的MV
   */
  static likedMVs(params: { limit: number; offset?: number }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/mv/sublist",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }
}
