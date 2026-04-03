import NeteaseMusicApiService from "./ncm";
import ProxyService from "./proxy";
import StoreService from "./store";

export default class AppServices {
  static readonly Store = StoreService;
  static readonly Proxy = ProxyService;
  static readonly NeteaseMusicApi = NeteaseMusicApiService;
}
