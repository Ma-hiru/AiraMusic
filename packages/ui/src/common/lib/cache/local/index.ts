import { Log } from "@/common/lib/log";
import type { CacheObjectAsyncInterface } from "@/common/lib/cache/utils";

import { CacheStoreForRead } from "./read";
import { CacheStoreForSave } from "./save";
import { CacheStoreForCheck } from "./check";
import { CacheStoreForOther } from "./other";
import { CacheStoreForObject } from "./object";

export const Local = {
  check: CacheStoreForCheck,
  object: CacheStoreForObject,
  save: CacheStoreForSave,
  other: CacheStoreForOther,
  read: CacheStoreForRead
};

export class LocalSatisfiesInterface implements CacheObjectAsyncInterface {
  private local = Local;

  deleteMulti(ids: string[]) {
    return this.local.read.remove(ids);
  }

  deleteOne(id: string) {
    return this.deleteMulti([id]);
  }

  getMulti<T>(ids: string[]) {
    return this.local.object.getMulti<T>(ids);
  }

  getOne<T>(id: string) {
    return this.getMulti<T>([id]).then((res) => res[0]);
  }

  setMulti<T>(values: [string, T][]) {
    this.local.object.setMulti<T>(values.map(([id, data]) => ({ id, data }))).catch((err) => {
      Log.error(err);
    });
  }

  setOne<T>(id: string, value: T) {
    this.setMulti<T>([[id, value]]);
  }
}
