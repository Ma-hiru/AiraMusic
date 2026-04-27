export class CacheStoreUtils {
  static encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  static get BLANK_INDEX() {
    return {
      id: "",
      url: "",
      path: "",
      file: "",
      name: "",
      type: "",
      size: "",
      createTime: 0,
      eTag: "",
      lastModified: ""
    } satisfies CacheStoreIndex;
  }
}

export interface CacheObjectInterface {
  getOne<T>(id: string): Undefinable<T>;
  getMulti<T>(ids: string[]): Undefinable<T>[];
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
}

export interface CacheObjectAsyncInterface {
  getOne<T>(id: string): Promise<Nullable<T>>;
  getMulti<T>(ids: string[]): Promise<Nullable<T>[]>;
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
}
