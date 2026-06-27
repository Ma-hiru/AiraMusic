import { cacheRequest } from "../request";
import type {
  CacheStoreResponse,
  CacheStoreSaveJSONItem,
  CacheStoreSaveJSONParams,
  CacheStoreSaveURLItem,
  CacheStoreSaveURLParams
} from "@/types/cache";

export class CacheStoreForSave {
  static url(items: CacheStoreSaveURLItem[], method = "GET"): Promise<CacheStoreResponse<null>> {
    return cacheRequest("/api/save/url", {
      method: "POST",
      data: { items, method } satisfies CacheStoreSaveURLParams
    });
  }

  static json(items: CacheStoreSaveJSONItem[]): Promise<CacheStoreResponse<null>> {
    return cacheRequest("/api/save/json", {
      method: "POST",
      data: { items } satisfies CacheStoreSaveJSONParams
    });
  }
}
