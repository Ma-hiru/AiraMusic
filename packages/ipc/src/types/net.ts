/** IPC 只能传可序列化的数据，不能直接传 Request、Headers、AbortSignal 或 Response */
export interface NetFetchRequest {
  input: string;
  init: {
    body?: ArrayBuffer;
    headers: Record<string, string>;
  } & Pick<
    RequestInit,
    | "mode"
    | "cache"
    | "method"
    | "redirect"
    | "referrer"
    | "integrity"
    | "keepalive"
    | "credentials"
    | "referrerPolicy"
  >;
}

export interface NetFetchResponse {
  url: string;
  status: number;
  statusText: string;
  type: ResponseType;
  redirected: boolean;
  body: null | ArrayBuffer;
  headers: Record<string, string>;
}
