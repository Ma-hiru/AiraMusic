import { cacheRequest } from "./request";
import { Log } from "@mahiru/ui/public/utils/dev";
import { RequestCollector } from "@mahiru/ui/public/utils/collector";
import { CacheStoreUtils } from "@mahiru/ui/public/store/cache/utils";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

type CheckRequestItem = {
  id: string | number;
  timeLimit?: number;
  resolve: NormalFunc<[value: CacheCheckResult | PromiseLike<CacheCheckResult>]>;
};

type CheckOrStoreRequestItem = {
  id: string;
  url: string;
  update?: boolean;
  timeLimit?: number;
  resolve: NormalFunc<[value: CacheCheckResult | PromiseLike<CacheCheckResult>]>;
};

export class CacheStoreForCheck {
  checkCollectionsKey = "cache-check-collections";
  checkOrStoreCollectionsKey = "cache-check-or-store-collections";

  constructor() {
    RequestCollector.register<CheckRequestItem>(
      this.checkCollectionsKey,
      100,
      150,
      this.flushCheckCollections.bind(this)
    );
    RequestCollector.register<CheckOrStoreRequestItem>(
      this.checkOrStoreCollectionsKey,
      100,
      150,
      this.flushCheckOrStoreCollections.bind(this)
    );
  }

  private flushCheckCollections(collections: CheckRequestItem[]) {
    if (collections.length === 0) return;
    this.multi(collections)
      .then((res) => {
        collections.forEach((item, index) => {
          if (res.ok) {
            item.resolve(res.results[index] || { ok: false, index: CacheStoreUtils.BLANK_INDEX });
          } else {
            item.resolve({ ok: false, index: CacheStoreUtils.BLANK_INDEX });
          }
        });
      })
      .catch((err) => {
        Log.error({
          raw: err,
          message: "flushCheckCollections failed",
          label: "CacheStoreForCheck"
        });
        collections.forEach((item) => {
          item.resolve({ ok: false, index: CacheStoreUtils.BLANK_INDEX });
        });
      });
  }

  private flushCheckOrStoreCollections(collections: CheckOrStoreRequestItem[]) {
    if (collections.length === 0) return;
    this.flushCheckCollections(collections);
    let count = 0;
    const store = () => {
      if (ElectronServices.Net.quality.score < 0.7 || count >= 3) {
        this.orStoreMulti(collections).catch((err) => {
          Log.error({
            raw: err,
            message: "flushCheckOrStoreCollections store failed",
            label: "CacheStoreForCheck"
          });
        });
      } else {
        count++;
        requestIdleCallback(store, { timeout: 5000 });
      }
    };
    requestIdleCallback(store, { timeout: 5000 });
  }

  one(id: string | number, timeLimit?: number) {
    return new Promise<CacheCheckResult>((resolve) => {
      RequestCollector.add<CheckRequestItem>(this.checkCollectionsKey, {
        id,
        timeLimit,
        resolve
      });
    });
    // id = this.encode(id);
    // return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  multi(
    items: { id: string | number; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CacheCheckMultiResult> {
    return cacheRequest("/api/check/multi", {
      method: "POST",
      data: {
        items: items.map((item) => ({
          id: String(item.id),
          timeLimit: item.timeLimit
        })),
        timeLimit
      } satisfies CacheCheckMultiRequest
    });
  }

  orStoreOne(
    url: string,
    id: string | number = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number,
    signal?: AbortSignal
  ): Promise<CacheCheckResult> {
    if (method === "GET") {
      return new Promise<CacheCheckResult>((resolve) => {
        if (signal?.aborted) return;
        RequestCollector.add<CheckOrStoreRequestItem>(this.checkOrStoreCollectionsKey, {
          id: String(id),
          url,
          update,
          timeLimit,
          resolve
        });
      });
    } else {
      url = CacheStoreUtils.encode(url);
      id = CacheStoreUtils.encode(id);
      return cacheRequest("/api/check-store", {
        method,
        params: { id, url, update, timeLimit },
        signal
      });
    }
  }

  orStoreMulti(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CacheCheckMultiResult> {
    return cacheRequest("/api/check-store/multi", {
      method: "POST",
      data: { method, items } satisfies CacheStoreAsyncRequest
    });
  }
}
