import axios from "axios";

const request = axios.create({
  baseURL: "/cache",
  withCredentials: true,
  timeout: 15000
});

request.interceptors.response.use((response) => response.data);

export const Store = new (class {
  encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  check(id: string | number): Promise<CheckResult> {
    id = this.encode(id);
    return request("/api/check", { method: "GET", params: { id } });
  }

  checkMutil(items: { id: string }[]): Promise<CheckMutilResult> {
    return request("/api/check/mutil", {
      method: "POST",
      data: { items } satisfies CheckMutilRequest
    });
  }

  store(id: string, data: object) {
    return request("/api/store", { method: "POST", params: { id, data: JSON.stringify(data) } });
  }

  storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return request("/api/store/async", { method, params: { id, url } });
  }

  storeAsyncMutil(items: { id?: string; url: string }[], method: string = "GET") {
    return request("/api/store/async/mutil", {
      method: "POST",
      data: { items, method } satisfies StoreAsyncRequest
    });
  }

  checkOrStoreAsync(
    url: string,
    id = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number
  ): Promise<CheckResult> {
    url = this.encode(url);
    id = this.encode(id);
    return request("/api/check-store", { method, params: { id, url, update, timeLimit } });
  }

  checkOrStoreAsyncMutil(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CheckMutilResult> {
    return request("/api/check-store/mutil", {
      method: "POST",
      data: { method, items } satisfies StoreAsyncRequest
    });
  }

  fetch<T>(id: string | number): Promise<T> {
    id = this.encode(id);
    return request("/api/fetch", { method: "GET", params: { id } });
  }

  remove(id: number | string): Promise<CheckResult> {
    id = this.encode(id);
    return request("/api/remove", { method: "GET", params: { id } });
  }
})();

export type StoreIndex = {
  id: string;
  url: string;
  path: string;
  file: string;
  name: string;
  type: string;
  size: string;
  createTime: number;
  eTag: string;
  lastModified?: string;
};

export type CheckResult = {
  ok: boolean;
  index: StoreIndex;
};

export type CheckMutilRequest = {
  items: {
    id: string;
  }[];
};

export type CheckMutilResult = {
  ok: boolean;
  results: CheckResult[];
};

export type StoreAsyncRequest = {
  items: {
    id?: string;
    url: string;
    update?: boolean;
    timeLimit?: number;
  }[];
  method: string;
};
