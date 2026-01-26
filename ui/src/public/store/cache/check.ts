import { cacheRequest } from "./request";
import { CacheStoreBase } from "@mahiru/ui/public/store/cache/base";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { Net } from "@mahiru/ui/public/entry/net";

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

export class CacheStoreForCheck extends CacheStoreBase {
  checkCollectionsKey = "cache-check-collections";
  checkOrStoreCollectionsKey = "cache-check-or-store-collections";

  constructor() {
    super();
    this.registerRequestCollection<CheckRequestItem>(
      this.checkCollectionsKey,
      50,
      100,
      this.flushCheckCollections.bind(this)
    );
    this.registerRequestCollection<CheckOrStoreRequestItem>(
      this.checkOrStoreCollectionsKey,
      50,
      100,
      this.flushCheckOrStoreCollections.bind(this)
    );
  }

  private flushCheckCollections(collections: CheckRequestItem[]) {
    if (collections.length === 0) return;
    Log.debug("Starting flushCheckCollections", collections.length);
    this.multi(collections)
      .then((res) => {
        collections.forEach((item, index) => {
          if (res.ok) {
            item.resolve(res.results[index] || { ok: false, index: this.BLANK_INDEX });
          } else {
            item.resolve({ ok: false, index: this.BLANK_INDEX });
          }
        });
      })
      .catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            message: "flushCheckCollections failed",
            label: "CacheStoreForCheck"
          })
        );
        collections.forEach((item) => {
          item.resolve({ ok: false, index: this.BLANK_INDEX });
        });
      });
  }

  private flushCheckOrStoreCollections(collections: CheckOrStoreRequestItem[]) {
    if (collections.length === 0) return;
    Log.debug("Starting flushCheckOrStoreCollections check", collections.length);
    this.flushCheckCollections(collections);
    let count = 0;
    const store = () => {
      if (Net.getStatus().score < 0.7 || count >= 3) {
        Log.debug("Starting flushCheckOrStoreCollections store", collections.length);
        this.orStoreMulti(collections).catch((err) => {
          Log.error(
            new EqError({
              raw: err,
              message: "flushCheckOrStoreCollections store failed",
              label: "CacheStoreForCheck"
            })
          );
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
      this.addRequestToCollection<CheckRequestItem>(this.checkCollectionsKey, {
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
        this.addRequestToCollection<CheckOrStoreRequestItem>(this.checkOrStoreCollectionsKey, {
          id: String(id),
          url,
          update,
          timeLimit,
          resolve
        });
      });
    } else {
      url = this.encode(url);
      id = this.encode(id);
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
