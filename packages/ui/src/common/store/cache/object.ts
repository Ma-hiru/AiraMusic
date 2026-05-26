import { cacheRequest } from "@/common/store/cache/request";
import { CacheStoreUtils } from "@/common/store/cache/utils";

export class CacheStoreForObject {
  store<T>(id: string, data: T) {
    return cacheRequest({
      url: "/api/object/store",
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  storeMulti<T>(list: { id: string; data: T }[]) {
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
  ): Promise<Nullable<RawObject<T>>> {
    id = CacheStoreUtils.encode(id);
    return cacheRequest<any, RawObject<T> | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  fetchMulti<T>(ids: string[]): Promise<Nullable<RawObject<T>>[]> {
    return cacheRequest<any, Nullable<{ id: string; data: RawObject<T> }>[]>({
      url: "/api/object/fetch/multi",
      method: "POST",
      data: {
        ids
      }
    }).then((response) => {
      return response.map((item) => item?.data ?? null);
    });
  }
}
