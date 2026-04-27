import { LRUCacheWithTime } from "@mahiru/ui/public/utils/lru";
import { CacheObjectInterface } from "@mahiru/ui/public/store/cache/utils";

export class MemoryCache implements CacheObjectInterface {
  private cache = new LRUCacheWithTime<string, any>(5000, 1000 * 60 * 60);

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
