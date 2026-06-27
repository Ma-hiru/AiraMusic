import { accessToken, cacheRequest } from "@/common/lib/cache/request";
import type { CacheStoreDeleteParams, CacheStoreResponse } from "@/types/cache";
import RendererHTTPConstants from "@/common/constants/http";

export class CacheStoreForRead {
  static build(id: string | number) {
    const params = new URLSearchParams({
      id: String(id),
      key: accessToken
    });
    return `${RendererHTTPConstants.CacheBaseURL}/api/read?${params.toString()}`;
  }

  static json(ids: string[], timeLimit?: number): Promise<CacheStoreResponse<string[]>> {
    return cacheRequest("/api/read/json", {
      method: "POST",
      data: { ids, timeLimit }
    });
  }

  static remove(ids: CacheStoreDeleteParams["ids"]): Promise<CacheStoreResponse<null>> {
    return cacheRequest("/api/delete", {
      method: "POST",
      data: { ids } satisfies CacheStoreDeleteParams
    });
  }
}
