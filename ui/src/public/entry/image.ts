import { Time } from "@mahiru/ui/public/entry/time";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";
import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { Log } from "@mahiru/ui/public/utils/dev";
import { nextIdle } from "@mahiru/ui/public/utils/frame";
import { setCloseTask } from "@mahiru/ui/public/utils/close";

export type NeteaseImageCacheEntry = { time: number; file?: string };

@AddCacheStore
export class NeteaseImageClass {
  private initialized = false;
  private cache = new Map<string, NeteaseImageCacheEntry>();
  private timeLimit = Time.getCacheTimeLimit(7, "day");
  private countLimit = 10000;
  private readonly localCacheKey = "netease_image_cache";

  private sortCacheItems() {
    return [...this.cache].sort(([, a], [, b]) => a.time - b.time);
  }

  private limitSize(items: ReturnType<typeof this.sortCacheItems>) {
    // 超出数量限制，删除最旧缓存
    const removeCount = items.length - this.countLimit;
    if (removeCount > 0) {
      for (let i = 0; i < removeCount; i++) {
        this.cache.delete(items[i]![0]);
      }
      Log.debug("NeteaseImageEntry", `Removed ${removeCount} cached images to limit size`);
    }
  }

  private limitDate(items: ReturnType<typeof this.sortCacheItems>) {
    // 删除过期缓存
    const now = Date.now();
    const removeIDs: string[] = [];

    for (const [key, { time, file }] of items) {
      if (now - time > this.timeLimit) {
        // 删除旧缓存
        file && removeIDs.push(file);
        // 删除缓存
        this.cache.delete(key);
      }
    }

    void this.cacheStore.remove.multi(removeIDs);
    Log.debug("NeteaseImageEntry", `Removed ${removeIDs.length} expired cached images`);
  }

  constructor() {
    void this.init();
  }

  async init() {
    if (this.initialized) return;
    await nextIdle(5000);
    await this.loadCacheFromLocal();
    setCloseTask(this.localCacheKey, this.saveCacheToLocal.bind(this));
    this.initialized = true;
  }



  storeCacheURL(raw: Optional<string>, cache: Optional<string>, size?: NeteaseImageSize) {
    if (!raw) return;
    const key = size ? this.setSize(raw, size) : raw;

    const result = this.cache.get(key);
    if (!cache && result) {
      requestIdleCallback(() => {
        // 删除文件缓存
        result.file && this.cacheStore.remove.one(result.file);
        // 删除内存缓存
        this.cache.delete(key);
      });
    } else if (cache) {
      if (result?.file && result.file !== cache) {
        // 删除旧缓存
        void this.cacheStore.remove.one(result.file);
      }
      // 更新缓存
      this.cache.set(key, {
        time: Date.now(),
        file: cache
      });
    }

    if (this.cache.size % 100 === 0) {
      requestIdleCallback(() => {
        void this.saveCacheToLocal();
      });
    }
    if (this.cache.size > this.countLimit) {
      requestIdleCallback(() => {
        const sortItems = this.sortCacheItems();
        this.limitSize(sortItems);
        this.limitDate(sortItems);
      });
    }
  }

  fetchCacheURL(raw: Optional<string>, size?: NeteaseImageSize) {
    if (!raw) return undefined;
    const key = size ? this.setSize(raw, size) : raw;
    return this.cache.get(key)?.file || undefined;
  }

  async loadCacheFromLocal() {
    const cache = await this.cacheStore.object.fetch<Record<string, NeteaseImageCacheEntry>>(
      this.localCacheKey
    );
    if (cache) {
      this.cache = new Map(Object.entries(cache));
      requestIdleCallback(() => {
        const sortItems = this.sortCacheItems();
        this.limitDate(sortItems);
        this.limitSize(sortItems);
        Log.debug("NeteaseImageEntry", `Loaded ${this.cache.size} cached images index from local`);
      });
    }
  }

  saveCacheToLocal() {
    return this.cacheStore.object.store<Record<string, NeteaseImageCacheEntry>>(
      this.localCacheKey,
      Object.fromEntries(this.cache)
    );
  }
}

export interface NeteaseImageClass extends WithCacheStore {}

export const NeteaseImage = new NeteaseImageClass();
