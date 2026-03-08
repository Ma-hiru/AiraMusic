import { apiRequest } from "@mahiru/ui/public/api/request";

// 精品歌单分类 => 精品歌单
// 推荐歌单
// 每日推荐歌单（个性化推荐）
// 歌单(网友精选碟)

export default class _NeteasePlaylistAPI {
  /**
   * 获取歌单详情
   * @desc 歌单能看到歌单名字, 但看不到具体歌单内容 , 调用此接口 , 传入歌单 id, 可以获取对应歌单内的所有的音乐(未登录状态只能获取不完整的歌单,登录后是完整的)，
   * @return 返回的trackIds是完整的，tracks 则是不完整的，可拿全部 trackIds 请求一次 song/detail 接口
   * 获取所有歌曲的详情 (https://github.com/Binaryify/NeteaseCloudMusicApi/issues/452)
   * @param  id 歌单 id
   * @param s 歌单最近的 s 个收藏者, 默认为8
   * @param signal
   */
  detail(id: number, signal?: AbortSignal, s?: number) {
    return apiRequest<any, NeteaseAPI.NeteasePlaylistDetailResponse>({
      url: "/playlist/detail",
      params: { id, s, timestamp: Date.now() },
      signal
    });
  }

  /** 歌单更新播放量 */
  updatePlaycount(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/update/playcount",
      params: { id, timestamp: Date.now() }
    });
  }

  /**
   * 更新歌单信息
   * */
  updateInfo(params: {
    id: number;
    name?: string;
    desc?: string;
    /** 多个用 `;` 隔开,只能用官方规定标签 */
    tags?: string[] | string;
  }) {
    if (Array.isArray(params.tags)) params.tags = params.tags.join(";");
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/update",
      params: { ...params, timestamp: Date.now() }
    });
  }

  /** 调整歌单顺序
   * @desc 登录后调用此接口,可以根据歌单 id 顺序调整歌单顺序
   * */
  updateOrder(pid: number, ids: number[]) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/song/order/update",
      params: {
        pid,
        ids: `[${ids.join(",")}]`,
        timestamp: Date.now()
      }
    });
  }

  /** 歌单封面上传 */
  updateCover(
    id: number,
    image: Blob | File,
    params?: {
      /** 图片尺寸,默认为 300 */
      imgSize?: number;
      /** 水平裁剪偏移,方形图片可不传,默认为 0 */
      imgX?: number;
      /** imgY : 垂直裁剪偏移,方形图片可不传,默认为 0 */
      imgY?: number;
    }
  ) {
    const data = new FormData();
    data.append("imgFile", image);
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/cover/update",
      method: "post",
      params: { id, timestamp: Date.now(), ...params },
      data
    });
  }

  /**
   * 歌单分类
   * @desc 调用此接口,可获取歌单分类,包含 category 信息
   */
  category() {
    return apiRequest<never, NeteaseAPI.NeteasePlaylistCatlistResponse>("/playlist/catlist");
  }

  /** 热门歌单分类 */
  categoryHot() {
    return apiRequest<never, NeteaseAPI.NeteaseAPIResponse>("/playlist/hot");
  }

  /** 精品歌单标签列表 */
  categoryHighQuality() {
    return apiRequest<never, NeteaseAPI.NeteaseAPIResponse>("/playlist/highquality/tags");
  }

  /**
   * 收藏/取消收藏歌单
   * @desc 调用此接口, 传入类型和歌单 id 可收藏歌单或者取消收藏歌单
   */
  star(params: {
    /** 歌单 id */
    id: number;
    /** 类型,`1:收藏`,`2:取消收藏` */
    t: 1 | 2;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/subscribe",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 删除歌单
   * @desc 调用此接口 , 传入歌单id可删除歌单
   * @param id 歌单id,可多个,用逗号隔开
   */
  delete(id: number | number[] | string) {
    if (Array.isArray(id)) id = id.join(",");
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/delete",
      params: { id, timestamp: Date.now() }
    });
  }

  /**
   * 新建歌单
   * @desc 调用此接口 , 传入歌单名字可新建歌单
   */
  create(params: {
    /** 歌单名 */
    name: string;
    /** 是否设置为隐私歌单，默认否，传`10`则设置成隐私歌单 */
    privacy?: 10;
    /** 歌单类型,默认`NORMAL`,传 `VIDEO`则为视频歌单 */
    type?: "NORMAL" | "VIDEO";
  }) {
    params.type ||= "NORMAL";
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/create",
      params: { ...params, timestamp: Date.now() }
    });
  }

  /**
   * 对歌单添加或删除歌曲
   * @desc 调用此接口 , 可以添加歌曲到歌单或者从歌单删除某首歌曲 ( 需要登录 )
   */
  modify(params: {
    /** 从歌单增加单曲为 `add`, 删除为 `del` */
    op: "add" | "del";
    /** 歌单 id */
    pid: number;
    /** 歌曲 id,可多个,用逗号隔开 */
    tracks: number | number[] | string;
  }) {
    if (Array.isArray(params.tracks)) params.tracks = params.tracks.join(",");
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/tracks",
      params: { ...params, timestamp: Date.now() }
    });
  }

  /**
   * 心动模式/智能播放
   * @desc 登录后调用此接口 , 可获取心动模式/智能播放列表 必选参数 : id :
   */
  intelligence(params: {
    /** 歌曲 id */
    id: number;
    /** 歌单 id */
    pid: number;
    /** 要开始播放的歌曲的 id (可选参数) */
    sid?: number;
  }) {
    return apiRequest({
      url: "/playmode/intelligence/list",
      params
    });
  }

  /**
   * 歌单收藏者
   * @desc 调用此接口 , 传入歌单 id 可获取歌单的所有收藏者
   * */
  subscribers(params: {
    /** 歌单id */
    id: number;
    /** 取出评论数量 , 默认为 20 */
    limit?: number;
    /** 偏移数量 , 用于分页 , 如 :( 评论页数 -1)*20, 其中 20 为 limit 的值 */
    offset?: number;
  }) {
    return apiRequest<never, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/subscribers",
      params: { ...params, timestamp: Date.now() }
    });
  }

  /**
   * 相关歌单
   * @desc 调用此接口, 传入歌单 id, 获取相关歌单推荐
   * */
  relative(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/playlist/detail/rcmd/get",
      params: { id }
    });
  }

  /** 获取相似歌单 */
  similar(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/simi/playlist",
      params: { id }
    });
  }

  /**
   * 推荐歌单
   * @desc 调用此接口 , 可获取推荐歌单
   */
  recommend(
    /** 取出数量 , 默认为 30 (不支持 offset) */
    limit?: number
  ) {
    return apiRequest<any, NeteaseAPI.NeteaseRecommendPlaylistResponse>({
      url: "/personalized",
      params: { limit, timestamp: Date.now() }
    });
  }

  /**
   * 获取每日推荐歌单
   * @desc 调用此接口 , 可获得每日推荐歌单 ( 需要登录 )
   */
  recommendDaily() {
    return apiRequest<any, NeteaseAPI.NeteaseDailyRecommendPlaylistResponse>({
      url: "/recommend/resource",
      params: { timestamp: Date.now() }
    });
  }

  /**
   * 歌单 (网友精选碟)
   * @desc 调用此接口 , 可获取网友精选碟歌单
   */
  recommendTop(params: {
    /** 可选值为 'new' 和 'hot', 分别对应最新和最热 , 默认为 'hot' */
    order: "new" | "hot";
    /** tag, 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部",可从歌单分类接口获取(/playlist/catlist) */
    cat: string;
    /** 取出歌单数量 , 默认为 50 */
    limit?: number;
  }): Promise<NeteaseAPI.NeteaseTopPlaylistResponse> {
    return apiRequest({
      url: "/top/playlist",
      method: "get",
      params
    });
  }

  /** 获取精品歌单 */
  recommendHighQuality(params: {
    /** 比如 " 华语 "、" 古风 " 、" 欧美 "、" 流行 ", 默认为 "全部",可从精品歌单标签列表接口获取(/playlist/highquality/tags) */
    cat: string;
    /** 取出歌单数量 , 默认为 50 */
    limit: number;
    /** 分页参数,取上一页最后一个歌单的 updateTime 获取下一页数据 */
    before: number;
  }) {
    return apiRequest<any, NeteaseAPI.NeteaseHighQualityPlaylistsResponse>({
      url: "/top/playlist/highquality",
      params
    });
  }
}
