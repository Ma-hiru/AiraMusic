import { cacheRequest } from "./request";
import { CacheStoreUtils } from "@mahiru/ui/public/store/cache/utils";

export class CacheStoreForStore {
  one(url: string, id = url, method = "GET") {
    url = CacheStoreUtils.encode(url);
    id = CacheStoreUtils.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  multi(items: { id?: string; url: string }[], method = "GET") {
    return cacheRequest("/api/store/async/multi", {
      method: "POST",
      data: { items, method } satisfies CacheStoreAsyncRequest
    });
  }
}
