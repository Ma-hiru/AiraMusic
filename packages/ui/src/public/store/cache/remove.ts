import { cacheRequest } from "./request";
import { RequestCollector } from "@mahiru/ui/public/utils/collector";
import { CacheStoreUtils } from "@mahiru/ui/public/store/cache/utils";

export class CacheStoreForRemove {
  removeCollectionsKey = "cache-remove-collections";

  constructor() {
    RequestCollector.register<string>(this.removeCollectionsKey, 1000, 5000, this.multi.bind(this));
  }

  one(id: number | string) {
    RequestCollector.add<string>(this.removeCollectionsKey, String(id));
    // id = this.encode(id);
    // return cacheRequest("/api/remove/async", { method: "GET", params: { id } });
  }

  oneSync(id: number | string): Promise<CacheCheckResult> {
    id = CacheStoreUtils.encode(id);
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
