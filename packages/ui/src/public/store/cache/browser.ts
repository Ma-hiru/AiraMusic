import { CacheObjectInterface } from "@mahiru/ui/public/store/cache/utils";

export class BrowserCache implements CacheObjectInterface {
  getOne<T>(id: string): Undefinable<T> {
    return JSON.parse(localStorage.getItem(id) ?? "null") ?? undefined;
  }

  getMulti<T>(ids: string[]): Undefinable<T>[] {
    return ids.map((id) => this.getOne(id));
  }

  setOne<T>(id: string, value: T) {
    localStorage.setItem(id, JSON.stringify(value));
  }

  setMulti<T>(values: [string, T][]) {
    values.forEach(([id, value]) => this.setOne(id, value));
  }

  deleteOne(id: string) {
    localStorage.removeItem(id);
  }

  deleteMulti(ids: string[]) {
    ids.forEach((id) => this.deleteOne(id));
  }
}
