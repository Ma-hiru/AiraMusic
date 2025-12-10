import { cacheRequest } from "@mahiru/ui/utils/request";

/** CacheStore api  */
export class CacheStore {
  private constructor() {}

  static encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  static check(id: string | number, timeLimit?: number): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  static checkMutil(
    items: { id: string; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check/mutil", {
      method: "POST",
      data: { items, timeLimit } satisfies CheckMutilRequest
    });
  }

  static storeObject(id: string, data: object) {
    return cacheRequest("/api/store/object", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  static fetchObject<T extends object>(id: string, timeLimit?: number): Promise<T | null> {
    id = this.encode(id);
    return cacheRequest<any, T | null>("/api/fetch/object", {
      method: "GET",
      params: { id, timeLimit }
    });
  }

  static storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  static storeAsyncMutil(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/mutil", {
      method: "POST",
      data: { items, method } satisfies StoreAsyncRequest
    });
  }

  static checkOrStoreAsync(
    url: string,
    id = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number
  ): Promise<CheckResult> {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/check-store", { method, params: { id, url, update, timeLimit } });
  }

  static checkOrStoreAsyncMutil(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check-store/mutil", {
      method: "POST",
      data: { method, items } satisfies StoreAsyncRequest
    });
  }

  static fetch<T>(id: string | number): Promise<T> {
    id = this.encode(id);
    return cacheRequest("/api/fetch", { method: "GET", params: { id } });
  }

  static remove(id: number | string): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }
}

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
    timeLimit?: number;
  }[];
  timeLimit?: number;
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
