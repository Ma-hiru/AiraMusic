import { apiRequest } from "@mahiru/ui/public/api/request";

/**
 * 获取专辑内容
 * @param id 专辑 id
 */
export function getAlbum(id: number) {
  return apiRequest<{ id: number }, NeteaseAPIResponse>({
    url: "/album",
    method: "get",
    params: {
      id
    }
  });
}

/**
 * 全部新碟
 * @desc 登录后调用此接口 ,可获取全部新碟
 */
// TODO: 官方返回体包含 albums/albumCount，这里后续可补 `NeteaseAlbumNewResponse` 类型
export function newAlbums(params: {
  /** 返回数量 , 默认为 30 */
  limit?: number;
  /** 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
  offset?: number;
  /** ALL:全部,ZH:华语,EA:欧美,KR:韩国,JP:日本 */
  area?: "ALL" | "ZH" | "EA" | "KR" | "JP";
}) {
  return apiRequest({
    url: "/album/new",
    method: "get",
    params
  });
}

/**
 * 专辑动态信息
 * @desc 调用此接口 , 传入专辑 id, 可获得专辑动态信息,如是否收藏,收藏数,评论数,分享数
 * @param id 专辑id
 */
export function albumDynamicDetail(id: number) {
  return apiRequest<{ id: number; timestamp: number }, NeteaseAPIResponse>({
    url: "/album/detail/dynamic",
    method: "get",
    params: { id, timestamp: new Date().getTime() }
  });
}

/**
 * 收藏/取消收藏专辑
 * @desc 调用此接口,可 收藏/取消收藏 专辑
 */
export function likeAAlbum(params: {
  /** 返专辑 id */
  id: number;
  /** 1 为收藏,其他为取消收藏 */
  t: number;
}) {
  return apiRequest<typeof params, NeteaseAPIResponse>({
    url: "/album/sub",
    method: "post",
    params
  });
}
