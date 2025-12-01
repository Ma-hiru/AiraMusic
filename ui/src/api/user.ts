import request from "./utils/request";

/**
 * 获取用户详情
 * @desc 登录后调用此接口 , 传入用户 id, 可以获取用户详情
 * @param uid 用户 id
 */
export function userDetail(uid: number) {
  return request<{ uid: number; timestamp: number }, NeteaseUserDetailResponse>({
    url: "/user/detail",
    method: "get",
    params: {
      uid,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取账号详情
 * @desc 登录后调用此接口 ,可获取用户账号信息
 */
export function userAccount() {
  return request<{ timestamp: number }, NeteaseUserAccountResponse>({
    url: "/user/account",
    method: "get",
    params: {
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取用户歌单
 * @desc 登录后调用此接口 , 传入用户 id, 可以获取用户歌单
 */
export function userPlaylist(params: {
  /** 用户 id */
  uid: number;
  /** 返回数量 , 默认为 30 */
  limit: number;
  /** 偏移数量，用于分页 , 如 :( 页数 -1)*30, 其中 30 为 limit 的值 , 默认为 0 */
  offset?: number;
}) {
  return request<typeof params, NeteaseUserPlaylistResponse>({
    url: "/user/playlist",
    method: "get",
    params
  });
}

/**
 * 获取用户播放记录
 * @desc 登录后调用此接口 , 传入用户 id, 可获取用户播放记录
 */
export function userPlayHistory(params: {
  /** 用户 id */
  uid: number;
  /** type=1 时只返回 weekData, type=0 时返回 allData */
  type: 1 | 0;
}) {
  return request<typeof params, NeteaseAPIResponse>({
    url: "/user/record",
    method: "get",
    params
  });
}

/**
 * 喜欢音乐列表（需要登录）
 * @desc 调用此接口 , 传入用户 id, 可获取已喜欢音乐id列表(id数组)
 * @param uid 用户 id
 */
export function userLikedSongsIDs(uid: number) {
  return request<{ uid: number; timestamp: number }, NeteaseLikedSongIdsResponse>({
    url: "/likelist",
    method: "get",
    params: {
      uid,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 每日签到
 * @desc 调用此接口可签到获取积分
 * @param type 签到类型 , 默认 0, 其中 0 为安卓端签到 ,1 为 web/PC 签到
 */
export function dailySignin(type: 0 | 1 = 0) {
  return request<{ type: number; timestamp: number }, NeteaseAPIResponse>({
    url: "/daily_signin",
    method: "post",
    params: {
      type,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取收藏的专辑（需要登录）
 * @desc 调用此接口可获取到用户收藏的专辑
 */
export function likedAlbums(params: {
  /** 返回数量 , 默认为 25 */
  limit: number;
  /** 偏移数量，用于分页 , 如 :( 页数 -1)*25, 其中 25 为 limit 的值 , 默认为 0 */
  offset?: number;
}) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/album/sublist",
    method: "get",
    params: {
      limit: params.limit,
      offset: params.offset,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取收藏的歌手（需要登录）
 * @desc 调用此接口可获取到用户收藏的歌手
 */
export function likedArtists(params: { limit: number; offset?: number }) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/artist/sublist",
    method: "get",
    params: {
      limit: params.limit,
      offset: params.offset,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取收藏的MV（需要登录）
 * @desc 调用此接口可获取到用户收藏的MV
 */
export function likedMVs(params: { limit: number; offset?: number }) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/mv/sublist",
    method: "get",
    params: {
      limit: params.limit,
      offset: params.offset,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 上传歌曲到云盘（需要登录）
 */
export function uploadSong(file: Blob) {
  const formData = new FormData();
  formData.append("songFile", file);
  return request<{ timestamp: number }, NeteaseAPIResponse>({
    url: "/cloud",
    method: "post",
    params: {
      timestamp: new Date().getTime()
    },
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data"
    },
    timeout: 200000
  }).catch((error: unknown) => {
    alert(`上传失败，Error: ${error}`);
  });
}

/**
 * 获取云盘歌曲（需要登录）
 * @desc 登录后调用此接口 , 可获取云盘数据 , 获取的数据没有对应 url, 需要再调用一 次 /song/url 获取 url
 * - limit :
 * - offset :
 * @param {Object} params
 * @param {number} params.limit
 * @param {number=} params.offset
 */
export function cloudDisk(
  params: {
    /** 返回数量 , 默认为 200 */
    limit?: number;
    /** 偏移数量，用于分页 , 如 :( 页数 -1)*200, 其中 200 为 limit 的值 , 默认为 0 */
    offset?: number;
  } = { limit: 200 }
) {
  return request<typeof params & { timestamp: number }, NeteaseAPIResponse>({
    url: "/user/cloud",
    method: "get",
    params: {
      limit: params.limit ?? 200,
      offset: params.offset,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 获取云盘歌曲详情（需要登录）
 */
export function cloudDiskTrackDetail(id: number) {
  return request<{ id: number; timestamp: number }, NeteaseAPIResponse>({
    url: "/user/cloud/detail",
    method: "get",
    params: {
      timestamp: new Date().getTime(),
      id
    }
  });
}

export function cloudDiskTrackDelete(id: number | string | number[]) {
  return request<{ id: unknown; timestamp: number }, NeteaseAPIResponse>({
    url: "/user/cloud/del",
    method: "get",
    params: {
      timestamp: new Date().getTime(),
      id
    }
  });
}
