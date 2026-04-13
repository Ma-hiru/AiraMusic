import { apiRequest } from "@mahiru/ui/public/source/netease/api/request";

export default class _NeteaseWikiAPI {
  /**
   * 音乐百科 - 简要信息
   * @desc 调用此接口可以获取歌曲的音乐百科简要信息
   * */
  static songWikiSummary(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/song/wiki/summary",
      params: { id }
    });
  }

  /**
   * 歌曲简要百科信息
   * @desc 登录后调用此接口,使用此接口,传入歌曲 id,可获取对应的歌曲简要百科信息
   * */
  static ugcSong(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseUGCSongResponse>({
      url: "/ugc/song/get",
      params: { id }
    });
  }

  /**
   * 专辑简要百科信息
   * @desc 登录后调用此接口,使用此接口,传入专辑 id,可获取对应的专辑简要百科信息
   * */
  static ugcAlbum(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseUGCAlbumResponse>({
      url: "/ugc/album/get",
      params: { id }
    });
  }

  /**
   * 歌手简要百科信息
   * @desc 登录后调用此接口,使用此接口,传入歌手 id,可获取对应的歌手简要百科信息
   * */
  static ugcArtist(id: number) {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>({
      url: "/ugc/artist/get",
      params: { id }
    });
  }
}
