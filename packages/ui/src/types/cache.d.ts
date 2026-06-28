import type { StoreCategory } from "@/common/enum";

type CacheStoreResponse<T> =
  | {
      code: 200;
      data: T;
    }
  | {
      code: 500 | 400;
      error: string;
    };

type CacheStoreIndex = {
  /** 存储ID，具备唯一性 */
  id: string;
  /** 下载文件的URL */
  url: string;
  /** 原始（下载）文件名 */
  name: string;
  mime: string;
  size: number;
  createTime: number;
  eTag: string;
  lastModified: string;
  category: number;
};

type CacheStoreSaveURLItem = {
  id: string;
  url: string;
  category: StoreCategory;
  update?: boolean;
  timeLimit?: number;
};

type CacheStoreSaveJSONItem = {
  id: string;
  data: string;
  update?: boolean;
  timeLimit?: number;
};

type CacheStoreSaveURLParams = {
  items: CacheStoreSaveURLItem[];
  method: string;
};

type CacheStoreSaveJSONParams = {
  items: CacheStoreSaveJSONItem[];
};

type CacheStoreDeleteParams = {
  ids: string[];
};

type CacheStoreCheckItem = {
  id: string;
  timeLimit?: number;
};

type CacheStoreCheckIdxParams = {
  items: CacheStoreCheckItem[];
};

type CacheStoreCheckRes = {
  ok: boolean;
  idx: CacheStoreIndex;
};

type CacheStoreMoveProgress = {
  total: number;
  current: number;
  percent: number;
  failed: number;
};

type CacheStoreInfo = {
  size: number;
  count: number;
  path: string;
};

type CacheStoreCategories = {
  image: number;
  audio: number;
  video: number;
  json: number;
  other: number;
};
