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

type CacheCheckMultiRequest = {
  items: {
    id: string;
    timeLimit?: number;
  }[];
  timeLimit?: number;
};

type CacheCheckMultiResult = {
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
