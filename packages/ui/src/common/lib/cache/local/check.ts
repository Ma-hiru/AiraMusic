import type {
  CacheStoreCheckRes,
  CacheStoreResponse,
  CacheStoreCheckItem,
  CacheStoreSaveURLItem,
  CacheStoreSaveURLParams,
  CacheStoreCheckIdxParams
} from "@/types/cache";

import { cacheRequest } from "../request";

export class CacheStoreForCheck {
  private static collections: Task[] = [];

  private static _read(
    items: CacheStoreCheckItem[]
  ): Promise<CacheStoreResponse<CacheStoreCheckRes[]>> {
    return cacheRequest("/api/check/readonly", {
      method: "POST",
      data: { items } satisfies CacheStoreCheckIdxParams
    });
  }

  private static _readOrStore(
    items: CacheStoreSaveURLItem[],
    method = "GET"
  ): Promise<CacheStoreResponse<CacheStoreCheckRes[]>> {
    return cacheRequest("/api/check/store", {
      method: "POST",
      data: { method, items } satisfies CacheStoreSaveURLParams
    });
  }

  private static timer: Nullable<number> = null;
  private static add(task: Task) {
    this.collections.push(task);
    this.timer && window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => {
      let task;
      const readTask: ReadTask[] = [];
      const readOrStoreTask: ReadOrStoreTask[] = [];
      while ((task = this.collections.shift())) {
        if (task.type === "read") {
          readTask.push(task);
        } else {
          readOrStoreTask.push(task);
        }
      }
      this.handleReadTask("read", readTask);
      this.handleReadTask("readOrStore", readOrStoreTask);
    }, 100);
  }

  private static handleReadTask(
    type: "read" | "readOrStore",
    task: ReadTask[] | ReadOrStoreTask[]
  ) {
    if (task.length === 0) return;

    let finalItems: CacheStoreSaveURLParams["items"] | CacheStoreCheckIdxParams["items"] = [];
    const chunks: number[] = [];
    for (const t of task) {
      finalItems = finalItems.concat(t.items as CacheStoreSaveURLParams["items"]);
      chunks.push(t.items.length);
    }

    const promise =
      type === "read"
        ? this._read(finalItems as CacheStoreCheckIdxParams["items"])
        : this._readOrStore(finalItems as CacheStoreSaveURLParams["items"]);

    promise
      .then((res) => {
        if (res.code === 200) {
          const data = res.data;
          let offset = 0;
          task.forEach((t, taskIndex) => {
            const chunk = chunks[taskIndex]!;
            t.resolve({
              code: 200,
              data: data.slice(offset, offset + chunk)
            });
            offset += chunk;
          });
        } else {
          for (const t of task) t.reject(res.error);
        }
      })
      .catch((err) => {
        for (const t of task) t.reject(err);
      });
  }

  static readOne(item: CacheStoreCheckItem): Promise<CacheStoreResponse<CacheStoreCheckRes>> {
    return this.read([item]).then((res) => {
      if (res.code === 200) return { code: 200, data: res.data[0]! };
      return res;
    });
  }

  static read(items: CacheStoreCheckItem[]): Promise<CacheStoreResponse<CacheStoreCheckRes[]>> {
    const { reject, promise, resolve } =
      Promise.withResolvers<CacheStoreResponse<CacheStoreCheckRes[]>>();
    this.add({ type: "read", items, resolve, reject });
    return promise;
  }

  static readOrStoreOne(
    item: CacheStoreSaveURLItem
  ): Promise<CacheStoreResponse<CacheStoreCheckRes>> {
    return this.readOrStore([item]).then((res) => {
      if (res.code === 200) return { code: 200, data: res.data[0]! };
      return res;
    });
  }

  static readOrStore(
    items: CacheStoreSaveURLItem[]
  ): Promise<CacheStoreResponse<CacheStoreCheckRes[]>> {
    const { reject, promise, resolve } =
      Promise.withResolvers<CacheStoreResponse<CacheStoreCheckRes[]>>();
    this.add({ type: "readOrStore", items, resolve, reject });
    return promise;
  }
}

type ReadTask = {
  type: "read";
  items: CacheStoreCheckItem[];
  reject: NormalFunc<[res: any]>;
  resolve: NormalFunc<[res: CacheStoreResponse<CacheStoreCheckRes[]>]>;
};

type ReadOrStoreTask = {
  type: "readOrStore";
  items: CacheStoreSaveURLItem[];
  reject: NormalFunc<[res: any]>;
  resolve: NormalFunc<[res: CacheStoreResponse<CacheStoreCheckRes[]>]>;
};

type Task = ReadTask | ReadOrStoreTask;
