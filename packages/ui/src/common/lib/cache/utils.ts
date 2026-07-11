export class CacheStoreUtils {}

export interface CacheObjectInterface {
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
  getOne<T>(id: string): Undefinable<T>;
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  getMulti<T>(ids: string[]): Undefinable<T>[];
}

export interface CacheObjectAsyncInterface {
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  getOne<T>(id: string): Promise<Optional<Jsonify<T>>>;
  getMulti<T>(ids: string[]): Promise<Optional<Jsonify<T>>[]>;
}
