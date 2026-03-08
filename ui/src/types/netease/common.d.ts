namespace NeteaseAPI {
  interface NeteaseAPIResponse {
    code: number;
    message?: string;
    msg?: string;
    [property: string]: any;
  }
}
