import { cacheRequest } from "./request";
import { CacheStoreBase } from "./base";

export class CacheStoreForStore extends CacheStoreBase {
  one(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  multi(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/multi", {
      method: "POST",
      data: { items, method } satisfies CacheStoreAsyncRequest
    });
  }
}
