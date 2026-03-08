namespace NeteaseAPI {
  interface NeteaseLoginResponse extends NeteaseAPIResponse {
    token?: string;
    cookie?: string;
    profile?: NeteaseUserDetailResponse["profile"];
    account?: NeteaseUserAccountResponse["account"];
  }

  interface NeteaseLoginQrKeyResponse extends NeteaseAPIResponse {
    data: {
      unikey: string;
      qrurl?: string;
    };
  }

  interface NeteaseLoginQrCreateResponse extends NeteaseAPIResponse {
    data: {
      qrurl: string;
      qrimg?: string;
    };
  }

  interface NeteaseLoginQrCheckResponse extends NeteaseAPIResponse {
    message?: string;
    cookie: string;
    nickname?: string;
    avatarUrl?: string;
  }
}
