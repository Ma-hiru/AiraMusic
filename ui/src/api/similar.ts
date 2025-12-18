import { apiRequest } from "@mahiru/ui/utils/request";

/** 获取相似歌单 */
export function similarPlaylist(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/simi/playlist", { params: { id } });
}

/** 获取相似歌手 */
export function similarArtist(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/simi/playlist", { params: { id } });
}

/** 获取相似音乐 */
export function similarSong(id: number) {
  return apiRequest<any, NeteaseAPIResponse>("/simi/song", { params: { id } });
}
