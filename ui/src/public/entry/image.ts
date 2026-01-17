import { Time } from "@mahiru/ui/public/entry/time";
import { NeteaseImageSize } from "@mahiru/ui/public/enum/image";
import { AddCacheStore, WithCacheStore } from "@mahiru/ui/public/store/cache";
import { Log } from "@mahiru/ui/public/utils/dev";
import { nextIdle } from "@mahiru/ui/public/utils/frame";
import { setCloseTask } from "@mahiru/ui/public/utils/close";

export type NeteaseImageCacheEntry = { time: number; url?: string };

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
      Log.trace("NeteaseImageEntry", `Removed ${removeCount} cached images to limit size`);
    }
  }

  private limitDate(items: ReturnType<typeof this.sortCacheItems>) {
    // 删除过期缓存
    const now = Date.now();
    const removeIDs: string[] = [];

    for (const [key, { time, url }] of items) {
      if (now - time > this.timeLimit) {
        // 删除旧缓存
        url && removeIDs.push(url);
        // 删除缓存
        this.cache.delete(key);
      }
    }

    void this.cacheStore.removeMulti(removeIDs);
    Log.trace("NeteaseImageEntry", `Removed ${removeIDs.length} expired cached images`);
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

  /** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
  setSize<T extends Optional<string>>(
    url: T,
    size: NeteaseImageSize | number
  ): T extends Falsy ? undefined : string {
    if (!url || !url.startsWith("http")) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }
    if (!Number.isFinite(size) || size < 0) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }

    const u = new URL(url);
    if (size !== NeteaseImageSize.raw) {
      u.searchParams.set("param", `${size}y${size}`);
      u.searchParams.set("type", "webp");
    } else {
      u.searchParams.delete("param");
      u.searchParams.delete("type");
    }

    return <T extends Falsy ? undefined : string>u.toString();
  }

  storeCacheURL(raw: Optional<string>, cache: Optional<string>, size?: NeteaseImageSize) {
    if (!raw) return;
    const key = size ? this.setSize(raw, size) : raw;

    const result = this.cache.get(key);
    if (!cache && result) {
      requestIdleCallback(() => {
        // 删除文件缓存
        result.url && this.cacheStore.remove(result.url);
        // 删除内存缓存
        this.cache.delete(key);
      });
    } else if (cache) {
      if (result?.url && result.url !== cache) {
        // 删除旧缓存
        void this.cacheStore.remove(result.url);
      }
      // 更新缓存
      this.cache.set(key, {
        time: Date.now(),
        url: cache
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
    return this.cache.get(key)?.url || undefined;
  }

  async loadCacheFromLocal() {
    const cache = await this.cacheStore.fetchObject<Record<string, NeteaseImageCacheEntry>>(
      this.localCacheKey
    );
    if (cache) {
      this.cache = new Map(Object.entries(cache));
      requestIdleCallback(() => {
        const sortItems = this.sortCacheItems();
        this.limitDate(sortItems);
        this.limitSize(sortItems);
      });
    }
  }

  saveCacheToLocal() {
    return this.cacheStore.storeObject<Record<string, NeteaseImageCacheEntry>>(
      this.localCacheKey,
      Object.fromEntries(this.cache)
    );
  }
}

export interface NeteaseImageClass extends WithCacheStore {}

export const NeteaseImage = new NeteaseImageClass();
