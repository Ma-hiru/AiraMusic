import { accessToken, cacheRequest } from "./request";
import { CacheStoreUtils } from "@mahiru/ui/public/store/cache/utils";

export class CacheStoreForOther {
  fetch<T>(id: string | number): Promise<T> {
    id = CacheStoreUtils.encode(id);
    return cacheRequest("/api/fetch", { method: "GET", params: { id } });
  }

  move(
    path: string,
    onMessage: Nullable<
      NormalFunc<[data: { total: number; current: number; percent: number; failed: number }]>
    >,
    onDone: Nullable<NormalFunc<[data: string]>>
  ) {
    const es = new EventSource(`/api/move?path=${CacheStoreUtils.encode(path)}&key=${accessToken}`);
    es.addEventListener("done", (e) => {
      es.close();
      onDone?.(e.data);
    });
    es.addEventListener("message", (e) => {
      onMessage?.(JSON.parse(e.data));
    });
    es.addEventListener("error", () => {
      es.close();
      onDone?.("error");
    });
    return es;
  }

  size(): Promise<{ ok: boolean; size: number }> {
    return cacheRequest("/api/size");
  }

  clear(): Promise<{ ok: boolean; count: number }> {
    return cacheRequest("/api/clear");
  }

  count(): Promise<{ ok: boolean; count: number }> {
    return cacheRequest("/api/count");
  }

  sizeCategories(): Promise<{
    ok: boolean;
    image: number;
    audio: number;
    video: number;
    other: number;
  }> {
    return cacheRequest("/api/size/categories");
  }

  info(): Promise<{ ok: boolean; size: number; count: number; path: string }> {
    return cacheRequest("/api/size/categories");
  }
}
