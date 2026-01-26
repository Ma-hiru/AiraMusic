import { CacheStoreForCheck } from "./check";
import { CacheStoreForObject } from "./object";
import { CacheStoreForStore } from "./store";
import { CacheStoreForOther } from "./other";
import { CacheStoreForRemove } from "./remove";

export class CacheStoreClass {
  readonly check = new CacheStoreForCheck();
  readonly object = new CacheStoreForObject();
  readonly store = new CacheStoreForStore();
  readonly other = new CacheStoreForOther();
  readonly remove = new CacheStoreForRemove();
}

export const CacheStore = new CacheStoreClass();

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
  readonly cacheStore: CacheStoreClass;
}
