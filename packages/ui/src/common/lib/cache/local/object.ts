import { Log } from "@/common/lib/log";
import { CacheStoreForRead } from "@/common/lib/cache/local/read";
import { CacheStoreForSave } from "@/common/lib/cache/local/save";
import type { CacheStoreSaveJSONItem } from "@/types/cache";

export class CacheStoreForObject {
  static setOne<T>(obj: { data: T } & Omit<CacheStoreSaveJSONItem, "data">) {
    return this.setMulti([obj]);
  }

  static setMulti<T>(list: ({ data: T } & Omit<CacheStoreSaveJSONItem, "data">)[]) {
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
