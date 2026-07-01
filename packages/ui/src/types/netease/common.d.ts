namespace NeteaseAPI {
  interface NeteaseAPIResponse {
    code: number;
    msg?: string;
    message?: string;
  }

  interface NeteaseAPIResponseNew {
    status: number;
    cookie: string[];
    body: {
      code: number;
      message: string;
    };
  }
}
