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
