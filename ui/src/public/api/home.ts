import { apiRequest } from "@mahiru/ui/public/api/request";

export default class _NeteaseHomeAPI {
  /**
   * 所有榜单
   * @desc 调用此接口,可获取所有榜单 接口地址 : /toplist
   */
  toplists() {
    return apiRequest<any, NeteaseAPI.NeteaseAPIResponse>("/toplist");
  }

  /**
   * @desc 调用此接口 , 可获取 banner( 轮播图 ) 数据
   * @param type 资源类型,对应以下类型,默认为0 即 PC。
   *
   * 0: pc,1: android,2: iphone,3: ipad
   * */
  banner(type: 0 | 1 | 2 | 3 = 0) {
    return apiRequest<any, NeteaseAPI.NeteaseBannerResponse>({
      url: "/banner",
      params: { type, timestamp: Date.now() }
    });
  }
}
