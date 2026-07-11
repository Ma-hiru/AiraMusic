import RendererHTTPConstants from "@/common/constants/http";
import type {
  CacheStoreInfo,
  CacheStoreResponse,
  CacheStoreCategories,
  CacheStoreMoveProgress
} from "@/types/cache";

import { accessToken, cacheRequest } from "../request";

export class CacheStoreForOther {
  static move(
    path: string,
    onMessage: Nullable<NormalFunc<[progress: CacheStoreMoveProgress]>>,
    onDone: Nullable<NormalFunc<[message: string]>> // message为空时表示成功
  ) {
    const es = new EventSource(
      `${RendererHTTPConstants.CacheBaseURL}/api/move?path=${encodeURIComponent(path)}&key=${accessToken}`
    );
    es.addEventListener("message", (e) => {
      onMessage?.(JSON.parse(e.data));
    });
    es.addEventListener("done", (e) => {
      es.close();
      onDone?.(e.data);
    });
    es.addEventListener("error", () => {
      es.close();
      onDone?.("error");
    });
    return es;
  }

  static ping() {
    return cacheRequest<never, "ok">("/api/ping")
      .then((res) => res === "ok")
      .catch(() => false);
  }

  static info() {
    return cacheRequest<never, CacheStoreResponse<CacheStoreInfo>>("/api/info");
  }

  static clear() {
    return cacheRequest<never, CacheStoreResponse<number>>("/api/clear/all");
  }

  static clearInvalid() {
    return cacheRequest<never, CacheStoreResponse<null>>("/api/clear/invalid");
  }

  static categories() {
    return cacheRequest<never, CacheStoreResponse<CacheStoreCategories>>("/api/categories");
  }
}
