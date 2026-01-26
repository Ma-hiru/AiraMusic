import { cacheRequest } from "./request";
import { CacheStoreBase } from "./base";

export class CacheStoreForRemove extends CacheStoreBase {
  removeCollectionsKey = "cache-remove-collections";

  constructor() {
    super();
    this.registerRequestCollection<string>(
      this.removeCollectionsKey,
      1000,
      5000,
      this.multi.bind(this)
    );
  }

  one(id: number | string) {
    this.addRequestToCollection<string>(this.removeCollectionsKey, String(id));
    // id = this.encode(id);
    // return cacheRequest("/api/remove/async", { method: "GET", params: { id } });
  }

  oneSync(id: number | string): Promise<CacheCheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }

  multi(ids: string[]) {
    if (ids.length === 0) return;
    return cacheRequest("/api/remove/multi", {
      method: "POST",
      data: { ids }
    });
  }

  invalid() {
    return cacheRequest("/api/remove/invalid");
  }
}
