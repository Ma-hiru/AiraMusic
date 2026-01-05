import { accessToken, cacheRequest } from "@mahiru/ui/utils/cache";

class CacheStoreClass {
  encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  check(id: string | number, timeLimit?: number): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  checkMutil(
    items: { id: string; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CacheCheckMutilResult> {
    return cacheRequest("/api/check/mutil", {
      method: "POST",
      data: { items, timeLimit } satisfies CacheCheckMutilRequest
    });
  }

  storeObject(id: string, data: object) {
    return cacheRequest("/api/object/store", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  fetchObject<T>(
    id: string,
    timeLimit?: number,
    parts?: {
      objType: CacheObjType;
      objField: string | number | "length";
    }
  ): Promise<Nullable<T>> {
    id = this.encode(id);
    return cacheRequest<any, T | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  editObject<T = any, TObjType extends CacheObjType = CacheObjType>(
    payload: CacheEditObjectRequest<TObjType, T>
  ) {
    return cacheRequest<any, CacheEditObjectResponse>("/api/object/edit", {
      method: "POST",
      data: payload
    });
  }

  storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  storeAsyncMutil(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/mutil", {
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

  checkOrStoreAsyncMutil(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CacheCheckMutilResult> {
    return cacheRequest("/api/check-store/mutil", {
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
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
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

let cacheStoreSingleton: CacheStoreClass | undefined;

function getCache() {
  if (!cacheStoreSingleton) {
    cacheStoreSingleton = new CacheStoreClass();
  }
  return cacheStoreSingleton;
}

export function CacheStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "cacheStore", {
      get() {
        return getCache();
      }
    });
  });
}

export interface WithCacheSnapshot {
  readonly cacheStore: CacheStoreClass;
}
