import type { StoreCategory } from "@/common/enum";

type CacheStoreResponse<T> =
  | {
      data: T;
      code: 200;
    }
  | {
      error: string;
      code: 400 | 500;
    };

type CacheStoreIndex = {
  /** 存储ID，具备唯一性 */
  id: string;
  /** 下载文件的URL */
  url: string;
  /** 原始（下载）文件名 */
  eTag: string;
  mime: string;
  name: string;
  size: number;
  category: number;
  createTime: number;
  lastModified: string;
};

type CacheStoreSaveURLItem = {
  id: string;
  url: string;
  update?: boolean;
  timeLimit?: number;
  category: StoreCategory;
};

type CacheStoreSaveJSONItem = {
  id: string;
  data: string;
  update?: boolean;
  timeLimit?: number;
};

type CacheStoreSaveURLParams = {
  method: string;
  items: CacheStoreSaveURLItem[];
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
  failed: number;
  current: number;
  percent: number;
};

type CacheStoreInfo = {
  path: string;
  size: number;
  count: number;
};

type CacheStoreCategories = {
  json: number;
  audio: number;
  image: number;
  other: number;
  video: number;
};
