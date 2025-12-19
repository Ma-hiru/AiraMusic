import { CacheStore, EditObjectResponse } from "@mahiru/ui/store/cache";
import { startTransition } from "react";

export const PlaylistHistoryCache = new (class {
  private cacheKey = "playlist_history_cache";
  private maxSize = 500;
  private _outerUpdater: Nullable<NormalFunc> = null;

  constructor() {
    CacheStore.check(this.cacheKey).then((checkResult) => {
      if (!checkResult.ok) {
        // 初始化空数组
        void CacheStore.storeObject(this.cacheKey, []);
      }
    });
  }

  get outerUpdater() {
    return this._outerUpdater;
  }

  set outerUpdater(callback: Nullable<NormalFunc>) {
    this._outerUpdater = callback;
  }

  async load() {
    return (await CacheStore.fetchObject<NeteaseTrack[]>(this.cacheKey)) || [];
  }

  async save(data: NeteaseTrack[], outerUpdate: boolean = false) {
    await CacheStore.storeObject(this.cacheKey, data);
    outerUpdate && this.outerUpdater?.();
  }

  async findTrack(id: number): Promise<EditObjectResponse<{ index: number; value: NeteaseTrack }>> {
    return await CacheStore.editObject<NeteaseTrack[]>({
      id: this.cacheKey,
      objType: "array",
      objOperations: [{ name: "find", value: { field: "id", value: id } }]
    });
  }

  async addTrack(track: NeteaseTrack) {
    const findResult = await this.findTrack(track.id);
    if (findResult.ok && findResult.data) {
      // 已存在，提前到开始
      await CacheStore.editObject<NeteaseTrack[]>({
        id: this.cacheKey,
        objType: "array",
        objOperations: [
          { name: "splice", value: { start: findResult.data.index, deleteCount: 1 } },
          { name: "unshift", value: track }
        ],
        save: true
      });
    } else {
      // 不存在，直接添加到开始
      await CacheStore.editObject<NeteaseTrack[]>({
        id: this.cacheKey,
        objType: "array",
        objOperations: [{ name: "unshift", value: track }],
        save: true
      });
    }
    // 检查大小
    await this.limitSize();
    startTransition(() => {
      this.outerUpdater?.();
    });
  }

  async removeTrack(id: number) {
    const findResult = await this.findTrack(id);
    if (findResult.ok && findResult.data) {
      await CacheStore.editObject<NeteaseTrack[]>({
        id: this.cacheKey,
        objType: "array",
        objOperations: [
          { name: "splice", value: { start: findResult.data.index, deleteCount: 1 } }
        ],
        save: true
      });
    }
    startTransition(() => {
      this.outerUpdater?.();
    });
  }

  async clear() {
    await CacheStore.editObject<NeteaseTrack[]>({
      id: this.cacheKey,
      objType: "array",
      objOperations: [{ name: "clear" }],
      save: true
    });
    startTransition(() => {
      this.outerUpdater?.();
    });
  }

  async limitSize() {
    const size = await CacheStore.fetchObject<number>(this.cacheKey, undefined, {
      objType: "array",
      objField: "length"
    });
    if (typeof size === "number" && size > this.maxSize) {
      // 超出限制
      const count = this.maxSize - size;
      await CacheStore.editObject({
        id: this.cacheKey,
        objType: "array",
        save: true,
        objOperations: Array.from({ length: count }).map(() => ({ name: "pop" }))
      });
    }
  }
})();
