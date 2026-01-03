import { accessToken, cacheRequest } from "@mahiru/ui/utils/cache";

/** CacheStore api  */
export const CacheStore = new (class CacheStore {
  encode(str: string | number) {
    return encodeURIComponent(String(str));
  }

  check(id: string | number, timeLimit?: number): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/check", { method: "GET", params: { id, timeLimit } });
  }

  checkMutil(
    items: { id: string; timeLimit?: number }[],
    timeLimit?: number
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check/mutil", {
      method: "POST",
      data: { items, timeLimit } satisfies CheckMutilRequest
    });
  }

  storeObject(id: string, data: object) {
    return cacheRequest("/api/object/store", {
      method: "POST",
      data: { id, data: JSON.stringify(data) }
    });
  }

  fetchObject<T>(
    id: string,
    timeLimit?: number,
    parts?: {
      objType: ObjType;
      objField: string | number | "length";
    }
  ): Promise<Nullable<T>> {
    id = this.encode(id);
    return cacheRequest<any, T | null>("/api/object/fetch", {
      method: "GET",
      params: { id, timeLimit, ...(parts || {}) }
    });
  }

  editObject<T = any, TObjType extends ObjType = ObjType>(payload: EditObjectRequest<TObjType, T>) {
    return cacheRequest<any, EditObjectResponse>("/api/object/edit", {
      method: "POST",
      data: payload
    });
  }

  storeAsync(url: string, id = url, method: string = "GET") {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/store/async", { method, params: { id, url } });
  }

  storeAsyncMutil(items: { id?: string; url: string }[], method: string = "GET") {
    return cacheRequest("/api/store/async/mutil", {
      method: "POST",
      data: { items, method } satisfies StoreAsyncRequest
    });
  }

  checkOrStoreAsync(
    url: string,
    id: string | number = url,
    method: string = "GET",
    update?: boolean,
    timeLimit?: number,
    signal?: AbortSignal
  ): Promise<CheckResult> {
    url = this.encode(url);
    id = this.encode(id);
    return cacheRequest("/api/check-store", {
      method,
      params: { id, url, update, timeLimit },
      signal
    });
  }

  checkOrStoreAsyncMutil(
    items: { id?: string; url: string; update?: boolean; timeLimit?: number }[],
    method: string = "GET"
  ): Promise<CheckMutilResult> {
    return cacheRequest("/api/check-store/mutil", {
      method: "POST",
      data: { method, items } satisfies StoreAsyncRequest
    });
  }

  fetch<T>(id: string | number): Promise<T> {
    id = this.encode(id);
    return cacheRequest("/api/fetch", { method: "GET", params: { id } });
  }

  remove(id: number | string): Promise<CheckResult> {
    id = this.encode(id);
    return cacheRequest("/api/remove", { method: "GET", params: { id } });
  }

  move(
    path: string,
    onMessage: Nullable<
      NormalFunc<[data: { total: number; current: number; percent: number; failed: number }]>
    >,
    onDone: Nullable<NormalFunc<[data: string]>>
  ) {
    const es = new EventSource(`/api/move?path=${this.encode(path)}&key=${accessToken}`);
    es.addEventListener("done", (e) => {
      es.close();
      onDone?.(e.data);
    });
    es.addEventListener("message", (e) => {
      onMessage?.(JSON.parse(e.data));
    });
    es.addEventListener("error", () => {
      es.close();
      onDone?.("error");
    });
    return es;
  }
})();

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
