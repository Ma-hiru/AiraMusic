import { apiRequest } from "@/common/netease/api/request";

export default class _NeteaseAuthAPI {
  /**
   * 手机登录
   * @desc 支持密码登录与短信验证码登录，传入 `captcha` 后 `password` 失效
   */
  static loginWithPhone(params: {
    /** 手机号码 */
    phone: string;
    /** 密码 */
    password?: string;
    /** 短信验证码，使用 `sendCaptcha` 获取，传入后 password 将失效 */
    captcha?: string;
    /** 国家码，用于国外手机号登录，例如美国传入：1 */
    countrycode?: string;
    /** md5加密后的密码,传入后 password 将失效 */
    md5_password?: string;
  }) {
    return apiRequest<typeof params, NeteaseAPI.NeteaseLoginResponse>({
      url: "/login/cellphone",
      method: "post",
      params
    });
  }

  /**
   * 发送短信验证码
   * @desc 传入手机号码可发送登录用的短信验证码
   */
  static sendCaptcha(params: {
    /** 手机号码 */
    phone: string;
    /** 国家区号，默认 86 即中国 */
    ctcode?: string;
  }) {
    return apiRequest<typeof params, NeteaseAPI.NeteaseAPIResponse>({
      url: "/captcha/sent",
      method: "post",
      params
    });
  }

  /**
   * 邮箱登录
   */
  static loginWithEmail(params: {
    /** 163 网易邮箱 */
    email: string;
    /** 密码 */
    password: string;
    /** md5加密后的密码,传入后 password 将失效 */
    md5_password?: string;
  }) {
    return apiRequest<typeof params, NeteaseAPI.NeteaseLoginResponse>({
      url: "/login",
      method: "post",
      params
    });
  }

  /**
   * 二维码key生成接口
   */
  static loginQrCodeKey() {
    return apiRequest<{ timestamp: number }, NeteaseAPI.NeteaseLoginQrKeyResponse>({
      url: "/login/qr/key",
      method: "get",
      params: {
        timestamp: Date.now()
      }
    });
  }

  /**
   * 二维码生成接口
   * @desc 调用此接口传入`loginQrCodeKey`生成的key可生成二维码图片的base64和二维码信息,
   * 可使用base64展示图片,或者使用二维码信息内容自行使用第三方二维码生产库渲染二维码
   */
  static loginQrCodeCreate(params: {
    /** 二维码key */
    key: string;
    /** 传入后会额外返回二维码图片base64编码 */
    qrimg?: string;
  }) {
    return apiRequest<
      typeof params & { timestamp: number },
      NeteaseAPI.NeteaseLoginQrCreateResponse
    >({
      url: "/login/qr/create",
      method: "get",
      params: {
        ...params,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 二维码检测扫码状态接口
   * @desc 轮询此接口可获取二维码扫码状态,
   * @param key 二维码key
   * @return 800为二维码过期,801为等待扫码,802为待确认,803为授权登录成功(803状态码下会返回cookies)
   */
  static loginQrCodeCheck(key: string): Promise<NeteaseAPI.NeteaseLoginQrCheckResponse> {
    return apiRequest<{ key: string; timestamp: number }, NeteaseAPI.NeteaseLoginQrCheckResponse>({
      url: "/login/qr/check",
      method: "get",
      params: {
        key,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 刷新登录
   * @desc 调用此接口 , 可刷新登录状态
   * @example /login/refresh
   */
  static refreshCookie() {
    return apiRequest<never, NeteaseAPI.NeteaseAPIResponse>({
      url: "/login/refresh",
      method: "post"
    });
  }

  /**
   * 退出登录
   * @desc 调用此接口, 可退出登录
   */
  static logout() {
    return apiRequest<never, NeteaseAPI.NeteaseAPIResponse>({
      url: "/logout",
      method: "post"
    });
  }
}
