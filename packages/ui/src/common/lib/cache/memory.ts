import { LRUCache } from "@/common/utils/lru";
import { type CacheObjectInterface } from "@/common/lib/cache/utils";

export class MemoryCache implements CacheObjectInterface {
  private cache = new LRUCache<string, any>({ capacity: 5000, time_limit: 1000 * 60 * 60 });

  getOne<T>(id: string): Undefinable<T> {
    return this.cache.get(id);
  }

  getMulti<T>(ids: string[]): Undefinable<T>[] {
    return ids.map((id) => this.getOne(id));
  }

  setOne<T>(id: string, value: T) {
    this.cache.set(id, value);
    return this;
  }

  setMulti<T>(values: [string, T][]) {
    values.forEach(([id, value]) => this.setOne(id, value));
    return this;
  }

  deleteOne(id: string) {
    this.cache.delete(id);
    return this;
  }

  deleteMulti(ids: string[]) {
    ids.forEach((id) => this.deleteOne(id));
    return this;
  }
}
