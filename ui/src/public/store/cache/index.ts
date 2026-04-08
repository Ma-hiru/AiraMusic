import { CacheStoreForCheck } from "./check";
import { CacheStoreForObject } from "./object";
import { CacheStoreForStore } from "./store";
import { CacheStoreForOther } from "./other";
import { CacheStoreForRemove } from "./remove";

export class CacheStore {
  static readonly check = new CacheStoreForCheck();
  static readonly object = new CacheStoreForObject();
  static readonly store = new CacheStoreForStore();
  static readonly other = new CacheStoreForOther();
  static readonly remove = new CacheStoreForRemove();
}

export function AddCacheStore(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "cacheStore", {
      get() {
        return CacheStore;
      }
    });
  });
}

export interface WithCacheStore {
  readonly cacheStore: CacheStore;
}
