import { accessToken, cacheRequest } from "./request";

export class CacheStoreClass {
  encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  check(id: string | number, timeLimit?: number): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  checkMulti(
    items: { id: string; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CacheCheckMultiResult> {
    return cacheRequest("/api/check/multi", {
      method: "POST",
      data: { items, timeLimit } satisfies CacheCheckMultiRequest
    });
  }

  storeObject<T extends object>(id: string, data: T) {
    return cacheRequest("/api/object/store", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  fetchObject<T>(
    id: string,
    timeLimit?: number,
    parts?: {
      objType: "object" | "array";
      objField: string | number | "length";
    }
  ): Promise<Nullable<T>> {
    id = this.encode(id);
    return cacheRequest<any, T | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  storeAsyncMulti(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/multi", {
      method: "POST",
      data: { items, method } satisfies CacheStoreAsyncRequest
    });
  }

  checkOrStoreAsync(
    url: string,
    id: string | number = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number,
    signal?: AbortSignal
  ): Promise<CacheCheckResult> {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/check-store", {
      method,
      params: { id, url, update, timeLimit },
      signal
    });
  }

  checkOrStoreAsyncMulti(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CacheCheckMultiResult> {
    return cacheRequest("/api/check-store/multi", {
      method: "POST",
      data: { method, items } satisfies CacheStoreAsyncRequest
    });
  }

  fetch<T>(id: string | number): Promise<T> {
    id = this.encode(id);
    return cacheRequest("/api/fetch", { method: "GET", params: { id } });
  }

  remove(id: number | string): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove/async", { method: "GET", params: { id } });
  }

  removeSync(id: number | string): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }

  removeMulti(ids: string[]) {
    return cacheRequest("/api/remove/multi", {
      method: "POST",
      data: { ids }
    });
  }

  move(
    path: string,
    onMessage: Nullable<
      NormalFunc<[data: { total: number; current: number; percent: number; failed: number }]>
    >,
    onDone: Nullable<NormalFunc<[data: string]>>
  ) {
    const es = new EventSource(`/api/move?path=${this.encode(path)}&key=${accessToken}`);
    es.addEventListener("done", (e) => {
      es.close();
      onDone?.(e.data);
    });
    es.addEventListener("message", (e) => {
      onMessage?.(JSON.parse(e.data));
    });
    es.addEventListener("error", () => {
      es.close();
      onDone?.("error");
    });
    return es;
  }
}

export const CacheStore = new CacheStoreClass();

export function AddCacheStore(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "cacheStore", {
      get() {
        return CacheStore;
      }
    });
  });
}

export interface WithCacheStore {
  readonly cacheStore: CacheStoreClass;
}
