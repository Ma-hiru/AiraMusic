import { CacheStoreForSave } from "@/common/lib/cache/local/save";
import { CacheStoreForRead } from "@/common/lib/cache/local/read";
import { Log } from "@/common/lib/log";
import type { CacheStoreSaveJSONItem } from "@/types/cache";

export class CacheStoreForObject {
  static setOne<T>(obj: Omit<CacheStoreSaveJSONItem, "data"> & { data: T }) {
    return this.setMulti([obj]);
  }

  static setMulti<T>(list: (Omit<CacheStoreSaveJSONItem, "data"> & { data: T })[]) {
    return CacheStoreForSave.json(
      list.map((i) => {
        return {
          ...i,
          data: JSON.stringify(i.data),
          update: i.update ?? true
        };
      })
    );
  }

  static getOne<T>(id: string, timeLimit?: number): Promise<Optional<Jsonify<T>>> {
    return this.getMulti<T>([id], timeLimit).then((res) => res[0]);
  }

  static getMulti<T>(ids: string[], timeLimit?: number): Promise<Optional<Jsonify<T>>[]> {
    return CacheStoreForRead.json(ids, timeLimit)
      .then((res) => {
        if (res.code === 200) {
          return res.data.map((obj) => JSON.parse(obj));
        } else {
          Log.error("CacheStoreForObject", res.error);
          return [];
        }
      })
      .catch((err) => {
        Log.error("CacheStoreForObject", err);
        return [];
      });
  }
}
