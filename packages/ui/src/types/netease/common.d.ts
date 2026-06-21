namespace NeteaseAPI {
  interface NeteaseAPIResponse {
    code: number;
    message?: string;
    msg?: string;
  }

  interface NeteaseAPIResponseNew {
    status: number;
    cookie: string[];
    body: {
      code: number;
    };
  }
}
