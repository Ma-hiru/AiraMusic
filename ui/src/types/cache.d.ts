type CacheStoreIndex = {
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

type CacheCheckResult = {
  ok: boolean;
  index: CacheStoreIndex;
};

type CacheCheckMutilRequest = {
  items: {
    id: string;
    timeLimit?: number;
  }[];
  timeLimit?: number;
};

type CacheCheckMutilResult = {
  ok: boolean;
  results: CacheCheckResult[];
};

type CacheStoreAsyncRequest = {
  items: {
    id?: string;
    url: string;
    update?: boolean;
    timeLimit?: number;
  }[];
  method: string;
};

type CacheObjType = "object" | "array";

type CacheEditObjectOperation<T extends CacheObjType = CacheObjType> = T extends "array"
  ? CacheArrayOperations
  : T extends "object"
    ? CacheObjectOperations
    : CacheArrayOperations | CacheObjectOperations;

type CacheEditObjectItemOperations<T extends CacheObjType = CacheObjType> = {
  objType: T;
  objOperations: CacheEditObjectOperation<T>[];
};

type CacheArrayOperations =
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
  | {
      name: "map";
      itemOperations: CacheEditObjectItemOperations;
      field?: undefined;
      value?: undefined;
    };

type CacheObjectOperations =
  | { name: "set"; field: string; value: any }
  | { name: "delete"; field: string; value?: undefined }
  | { name: "clear"; value?: undefined; field?: undefined }
  | { name: "read"; field?: string; value?: undefined; itemOperations?: undefined }
  | { name: "has"; field: string; value?: undefined }
  | {
      name: "map";
      itemOperations: CacheEditObjectItemOperations;
      field?: undefined;
      value?: undefined;
    };

type CacheEditObjectRequest<TObjType extends CacheObjType = CacheObjType, TData = any> = {
  id: string;
  timeLimit?: number;
  objType: TObjType;
  objOperations: CacheEditObjectOperation<TObjType>[];
  save?: boolean;
  // 预留额外字段
  data?: TData;
};

type CacheEditObjectSummary = {
  touchedFields?: string[];
  touchedIndex?: number[];
};

type CacheEditObjectResponse<T = any> = {
  ok: boolean;
  data: T | null;
  summary?: CacheEditObjectSummary;
  error?: string;
};
