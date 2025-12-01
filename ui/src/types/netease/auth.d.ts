/**
 * `/login`、`/login/cellphone` 返回的登录结果。
 */
interface NeteaseLoginResponse extends NeteaseAPIResponse {
  token?: string;
  cookie?: string;
  profile?: NeteaseUserDetailResponse["profile"];
  account?: NeteaseUserAccountResponse["account"];
}

/**
 * `/login/qr/key` 返回的二维码 key。
 */
interface NeteaseLoginQrKeyResponse extends NeteaseAPIResponse {
  data: {
    unikey: string;
    qrurl?: string;
  };
}

/**
 * `/login/qr/create` 返回的二维码图片/链接。
 */
interface NeteaseLoginQrCreateResponse extends NeteaseAPIResponse {
  data: {
    qrurl: string;
    qrimg?: string;
  };
}

/**
 * `/login/qr/check` 返回的二维码登录状态。
 */
interface NeteaseLoginQrCheckResponse extends NeteaseAPIResponse {
  message?: string;
  cookie: string;
  nickname?: string;
  avatarUrl?: string;
}
