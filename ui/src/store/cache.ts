import { cacheRequest } from "@mahiru/ui/utils/request";

/** CacheStore api  */
export class CacheStore {
  private constructor() {}

  static encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  static check(id: string | number, timeLimit?: number): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  static checkMutil(
    items: { id: string; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check/mutil", {
      method: "POST",
      data: { items, timeLimit } satisfies CheckMutilRequest
    });
  }

  static storeObject(id: string, data: object) {
    return cacheRequest("/api/object/store", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  static fetchObject<T>(
    id: string,
    timeLimit?: number,
    parts?: {
      objType: ObjType;
      objField: string | number | "length";
    }
  ): Promise<T | null> {
    id = this.encode(id);
    return cacheRequest<any, T | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  static editObject<T = any, TObjType extends ObjType = ObjType>(
    payload: EditObjectRequest<TObjType, T>
  ) {
    return cacheRequest<any, EditObjectResponse<any>>("/api/object/edit", {
      method: "POST",
      data: payload
    });
  }

  static storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  static storeAsyncMutil(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/mutil", {
      method: "POST",
      data: { items, method } satisfies StoreAsyncRequest
    });
  }

  static checkOrStoreAsync(
    url: string,
    id = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number
  ): Promise<CheckResult> {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/check-store", { method, params: { id, url, update, timeLimit } });
  }

  static checkOrStoreAsyncMutil(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check-store/mutil", {
      method: "POST",
      data: { method, items } satisfies StoreAsyncRequest
    });
  }

  static fetch<T>(id: string | number): Promise<T> {
    id = this.encode(id);
    return cacheRequest("/api/fetch", { method: "GET", params: { id } });
  }

  static remove(id: number | string): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }
}

export type StoreIndex = {
  id: string;
  url: string;
  path: string;
  file: string;
  name: string;
  type: string;
  size: string;
  createTime: number;
  eTag: string;
  lastModified?: string;
};

export type CheckResult = {
  ok: boolean;
  index: StoreIndex;
};

export type CheckMutilRequest = {
  items: {
    id: string;
    timeLimit?: number;
  }[];
  timeLimit?: number;
};

export type CheckMutilResult = {
  ok: boolean;
  results: CheckResult[];
};

export type StoreAsyncRequest = {
  items: {
    id?: string;
    url: string;
    update?: boolean;
    timeLimit?: number;
  }[];
  method: string;
};

export type ObjType = "object" | "array";

export type EditObjectOperation<T extends ObjType = ObjType> = T extends "array"
  ? ArrayOperations
  : T extends "object"
    ? ObjectOperations
    : ArrayOperations | ObjectOperations;

export type EditObjectItemOperations<T extends ObjType = ObjType> = {
  objType: T;
  objOperations: EditObjectOperation<T>[];
};

type ArrayOperations =
  | { name: "unshift"; value: any; field?: undefined }
  | { name: "pop" | "shift"; value?: undefined; field?: undefined }
  | { name: "set"; value: { index: number; value: any }; field?: undefined }
  | { name: "insert"; value: { index: number; value: any }; field?: undefined }
  | {
      name: "splice";
      value: { start?: number; startIndex?: number; deleteCount: number; items?: any[] };
      field?: undefined;
    }
  | { name: "find"; value: { field?: string; value: any }; field?: undefined }
  | { name: "read"; value: number; field?: undefined }
  | { name: "map"; itemOperations: EditObjectItemOperations; field?: undefined; value?: undefined };

type ObjectOperations =
  | { name: "set"; field: string; value: any }
  | { name: "delete"; field: string; value?: undefined }
  | { name: "clear"; value?: undefined; field?: undefined }
  | { name: "read"; field?: string; value?: undefined; itemOperations?: undefined }
  | { name: "has"; field: string; value?: undefined }
  | { name: "map"; itemOperations: EditObjectItemOperations; field?: undefined; value?: undefined };

export type EditObjectRequest<TObjType extends ObjType = ObjType, TData = any> = {
  id: string;
  timeLimit?: number;
  objType: TObjType;
  objOperations: EditObjectOperation<TObjType>[];
  save?: boolean;
  // 预留额外字段
  data?: TData;
};

export type EditObjectSummary = {
  touchedFields?: string[];
  touchedIndex?: number[];
};

export type EditObjectResponse<T = any> = {
  ok: boolean;
  data: T | null;
  summary?: EditObjectSummary;
  error?: string;
};
