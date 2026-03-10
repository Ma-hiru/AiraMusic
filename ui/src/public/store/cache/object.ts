import { cacheRequest } from "@mahiru/ui/public/store/cache/request";
import { CacheStoreBase } from "./base";

export class CacheStoreForObject extends CacheStoreBase {
  store<T extends object>(id: string, data: T) {
    return cacheRequest("/api/object/store", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  storeMulti<T extends object>(list: { id: string; value: T }[]) {}

  fetch<T>(
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

  fetchMulti<T>(ids: string[]): Promise<Nullable<T>[]> {
    return Promise.resolve([]);
  }
}
