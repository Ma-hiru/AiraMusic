import { CacheStoreForCheck } from "./check";
import { CacheStoreForObject } from "./object";
import { CacheStoreForStore } from "./store";
import { CacheStoreForOther } from "./other";
import { CacheStoreForRemove } from "./remove";
import { BrowserCache } from "./browser";
import { MemoryCache } from "./memory";
import { CacheObjectAsyncInterface } from "./utils";
import { Log } from "@mahiru/ui/public/utils/dev";

const local = {
  check: new CacheStoreForCheck(),
  object: new CacheStoreForObject(),
  store: new CacheStoreForStore(),
  other: new CacheStoreForOther(),
  remove: new CacheStoreForRemove()
};
const browser = new BrowserCache();
const memory = new MemoryCache();

class LocalSatisfiesInterface implements CacheObjectAsyncInterface {
  local = local;

  deleteMulti(ids: string[]) {
    return this.local.remove.multi(ids);
  }

  deleteOne(id: string) {
    return this.local.remove.one(id);
  }

  getMulti<T>(ids: string[]) {
    return this.local.object.fetchMulti<T>(ids);
  }

  getOne<T>(id: string) {
    return this.local.object.fetch<T>(id);
  }

  setMulti<T>(values: [string, T][]) {
    this.local.object
      .storeMulti<T>(values.map(([id, value]) => ({ id, data: value })))
      .catch((err) => {
        Log.error(err);
      });
  }

  setOne<T>(id: string, value: T) {
    this.local.object.store<T>(id, value).catch((err) => {
      Log.error(err);
    });
  }
}

export class CacheStore {
  static readonly local = local;
  static readonly browser = browser;
  static readonly memory = memory;
  static readonly localSatisfiesInterface = new LocalSatisfiesInterface();
}
