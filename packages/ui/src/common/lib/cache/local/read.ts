import { Log } from "@/common/lib/log";
import { accessToken, cacheRequest } from "@/common/lib/cache/request";
import RendererHTTPConstants from "@/common/constants/http";
import type { CacheStoreResponse, CacheStoreDeleteParams } from "@/types/cache";

export class CacheStoreForRead {
  static build(id: number | string) {
    const params = new URLSearchParams({
      id: String(id),
      key: accessToken
    });
    return `${RendererHTTPConstants.CacheBaseURL}/api/read?${params.toString()}`;
  }

  static updateKey<T extends Optional<string>>(pathname: T) {
    if (!pathname) return pathname;
    try {
      const url = new URL(pathname, window.location.origin);
      if (url.pathname !== `${RendererHTTPConstants.CacheBaseURL}/api/read`) return pathname;

      const params = new URLSearchParams(url.search);
      if (!params.has("id")) return pathname;
      params.set("key", accessToken);
      return `${RendererHTTPConstants.CacheBaseURL}/api/read?${params.toString()}` as T;
    } catch (err) {
      Log.error(err);
      return pathname;
    }
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
