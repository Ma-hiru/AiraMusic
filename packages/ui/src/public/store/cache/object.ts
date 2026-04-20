import { cacheRequest } from "@mahiru/ui/public/store/cache/request";
import { CacheStoreUtils } from "@mahiru/ui/public/store/cache/utils";

export class CacheStoreForObject {
  store<T extends object>(id: string, data: T) {
    return cacheRequest({
      url: "/api/object/store",
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  storeMulti<T extends object>(list: { id: string; data: T }[]) {
    return cacheRequest({
      url: "/api/object/store/multi",
      method: "POST",
      data: {
        items: list.map((item) => ({
          id: item.id,
          data: JSON.stringify(item)
        }))
      }
    });
  }

  fetch<T>(
    id: string,
    timeLimit?: number,
    parts?: {
      objType: "object" | "array";
      objField: string | number | "length";
    }
  ): Promise<Nullable<T>> {
    id = CacheStoreUtils.encode(id);
    return cacheRequest<any, T | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  fetchMulti<T>(ids: string[]): Promise<Nullable<T>[]> {
    return cacheRequest({
      url: "/api/object/fetch/multi",
      method: "POST",
      data: {
        ids
      }
    });
  }
}
