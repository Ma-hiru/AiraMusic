import request from "./utils/request";

/**
 * 手机登录
 */
export function loginWithPhone(params: {
  /** 手机号码 */
  phone: string;
  /** 密码 */
  password: string;
  /** 国家码，用于国外手机号登录，例如美国传入：1 */
  countrycode?: string;
  /** md5加密后的密码,传入后 password 将失效 */
  md5_password?: string;
}) {
  return request<typeof params, NeteaseLoginResponse>({
    url: "/login/cellphone",
    method: "post",
    params
  });
}

/**
 * 邮箱登录
 */
export function loginWithEmail(params: {
  /** 163 网易邮箱 */
  email: string;
  /** 密码 */
  password: string;
  /** md5加密后的密码,传入后 password 将失效 */
  md5_password?: string;
}) {
  return request<typeof params, NeteaseLoginResponse>({
    url: "/login",
    method: "post",
    params
  });
}

/**
 * 二维码key生成接口
 */
export function loginQrCodeKey() {
  return request<{ timestamp: number }, NeteaseLoginQrKeyResponse>({
    url: "/login/qr/key",
    method: "get",
    params: {
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 二维码生成接口
 * @desc 调用此接口传入`loginQrCodeKey`生成的key可生成二维码图片的base64和二维码信息,
 * 可使用base64展示图片,或者使用二维码信息内容自行使用第三方二维码生产库渲染二维码
 */
export function loginQrCodeCreate(params: {
  /** 二维码key */
  key: string;
  /** 传入后会额外返回二维码图片base64编码 */
  qrimg?: string;
}) {
  return request<typeof params & { timestamp: number }, NeteaseLoginQrCreateResponse>({
    url: "/login/qr/create",
    method: "get",
    params: {
      ...params,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 二维码检测扫码状态接口
 * @desc 轮询此接口可获取二维码扫码状态,
 * @param key 二维码key
 * @return 800为二维码过期,801为等待扫码,802为待确认,803为授权登录成功(803状态码下会返回cookies)
 */
export function loginQrCodeCheck(key: string): Promise<NeteaseLoginQrCheckResponse> {
  return request<{ key: string; timestamp: number }, NeteaseLoginQrCheckResponse>({
    url: "/login/qr/check",
    method: "get",
    params: {
      key,
      timestamp: new Date().getTime()
    }
  });
}

/**
 * 刷新登录
 * @desc 调用此接口 , 可刷新登录状态
 * @example /login/refresh
 */
export function refreshCookie() {
  return request<never, NeteaseAPIResponse>({
    url: "/login/refresh",
    method: "post"
  });
}

/**
 * 退出登录
 * @desc 调用此接口, 可退出登录
 */
export function logout() {
  return request<never, NeteaseAPIResponse>({
    url: "/logout",
    method: "post"
  });
}
