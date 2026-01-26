import { cacheRequest } from "./request";
import { CacheStoreBase } from "./base";

export class CacheStoreForRemove extends CacheStoreBase {
  one(id: number | string): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove/async", { method: "GET", params: { id } });
  }

  oneSync(id: number | string): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }

  multi(ids: string[]) {
    return cacheRequest("/api/remove/multi", {
      method: "POST",
      data: { ids }
    });
  }

  invalid() {
    return cacheRequest("/api/remove/invalid");
  }
}
