import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseArtistAPI {
  /**
   * 调用此接口,可获取歌手详情
   * @param id 歌手 id
   * */
  static detail(id: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistDetailResponse>({
      url: "/artist/detail",
      method: "GET",
      params: { id }
    });
  }

  /**
   * 调用此接口,可获取歌手描述
   * @param id 歌手 id
   * */
  static desc(id: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistDescResponse>({
      url: "/artist/desc",
      method: "GET",
      params: { id }
    });
  }

  /**
   * 调用此接口,可获得歌手专辑内容
   * */
  static albums(props: { id: number; pageSize?: number; pageNo?: number }) {
    const { id, pageSize = 30, pageNo = 1 } = props;
    const offset = (pageNo - 1) * pageSize;
    const limit = pageSize;
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistAlbumResponse>({
      url: "/artist/album",
      method: "GET",
      params: { id, limit, offset }
    });
  }

  /**
   * 调用此接口,可关注/取消关注歌手
   * @param id 歌手 id
   * @param t 1: 关注, 0: 取消关注, 默认为 1
   * */
  static subscribe(id: number, t: 1 | 0 | boolean = 1) {
    t = Number(t) as 1 | 0;
    return apiRequest<unknown, NeteaseAPI.NeteaseAPIResponse>({
      url: "/artist/sub",
      method: "POST",
      params: { id, t }
    });
  }

  /**
   * 调用此接口,可获得歌手粉丝数量
   * @param id 歌手 id
   * */
  static followCount(id: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistFollowCountResponse>({
      url: "/artist/follow/count",
      method: "GET",
      params: { id }
    });
  }

  /**
   * 调用此接口,可获得相似歌手，需要登陆
   * @param id 歌手 id
   * */
  static similar(id: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseAPIResponse>({
      url: "/simi/artist",
      method: "GET",
      params: { id }
    });
  }

  /**
   * 调用此接口,可获取歌手热门 50 首歌曲
   * @param id 歌手 id
   * */
  static hotTracks(id: number) {
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistHotTracksResponse>({
      url: "/artist/top/song",
      method: "GET",
      params: { id }
    });
  }

  /**
   * 歌手榜
   * @desc 调用此接口, 可获取排行榜中的歌手榜
   * @param type 地区: 1 华语, 2 欧美, 3 韩国, 4 日本; 不传为全部
   * */
  static toplist(type?: 1 | 2 | 3 | 4) {
    return apiRequest<unknown, NeteaseAPI.NeteaseArtistToplistResponse>({
      url: "/toplist/artist",
      method: "GET",
      params: { type }
    });
  }
}
