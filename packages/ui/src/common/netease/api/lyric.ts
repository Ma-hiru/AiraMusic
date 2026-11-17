import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseLyricAPI {
  static get(id: number, signal?: AbortSignal) {
    return apiRequest<{ id: number }, NeteaseAPI.NeteaseLyricResponse>({
      url: "/lyric/new",
      method: "get",
      params: {
        id
      },
      signal
    });
  }

  static getYRC(id: number, signal?: AbortSignal) {
    return <Promise<NeteaseAPI.NeteaseLyricResponseNew>>fetch(
      `https://music.163.com/api/song/lyric/v1?tv=0&lv=0&rv=0&kv=0&yv=0&ytv=0&yrv=0&cp=false&id=${id}`,
      {
        method: "GET",
        credentials: "include",
        signal
      }
    ).then((res) => res.json());
  }
}
