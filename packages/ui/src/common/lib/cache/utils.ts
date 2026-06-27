export class CacheStoreUtils {}

export interface CacheObjectInterface {
  getOne<T>(id: string): Undefinable<T>;
  getMulti<T>(ids: string[]): Undefinable<T>[];
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
}

export interface CacheObjectAsyncInterface {
  getOne<T>(id: string): Promise<Optional<Jsonify<T>>>;
  getMulti<T>(ids: string[]): Promise<Optional<Jsonify<T>>[]>;
  setOne<T>(id: string, value: T): void;
  setMulti<T>(values: [string, T][]): void;
  deleteOne(id: string): void;
  deleteMulti(ids: string[]): void;
}
