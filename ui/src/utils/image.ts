import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";
import { Time } from "@mahiru/ui/utils/time";
import { setCloseTask } from "@mahiru/ui/utils/close";

@AddStoreSnapshot
class NeteaseImageClass {
  cache: Record<string, { time: number; url?: string }> = {};
  timeLimit: number = Time.getCacheTimeLimit(7, "day");
  countLimit: number = 10000;

  constructor() {}

  /** 设置图片的size，如果url为假值或者为本地路径，原地返回 */
  setSize<T extends Optional<string>>(
    url: T,
    size: NeteaseImageSize | number
  ): T extends Falsy ? undefined : string {
    if (!url || !url.startsWith("http")) {
      return <T extends Falsy ? undefined : string>(url || undefined);
    }
    const u = new URL(url);
    let param;
    switch (size) {
      case NeteaseImageSize.xs:
        param = "37y37";
        break;
      case NeteaseImageSize.sm:
        param = "100y100";
        break;
      case NeteaseImageSize.md:
        param = "388y388";
        break;
      case NeteaseImageSize.lg:
        param = "500y500";
        break;
      case NeteaseImageSize.raw:
        param = "";
        break;
    }
    if (param === undefined && Number.isFinite(size)) {
      param = `${size}y${size}`;
    }
    if (param) {
      u.searchParams.set("param", param);
    } else {
      u.searchParams.delete("param");
    }
    param && u.searchParams.set("type", "webp");
    return <T extends Falsy ? undefined : string>u.toString();
  }

  storeCacheURL(raw: Optional<string>, cache: Optional<string>, size?: NeteaseImageSize) {
    if (!raw) return;
    const key = size ? this.setSize(raw, size) : raw;

    const result = this.cache[key];
    if (!cache && result) {
      // 删除旧缓存
      result.url && this.cacheStore.remove(result.url);
      // 删除缓存
      delete this.cache[key];
    } else if (cache) {
      if (result?.url && result.url !== cache) {
        // 删除旧缓存
        void this.cacheStore.remove(result.url);
      }
      // 更新缓存
      this.cache[key] = {
        time: Date.now(),
        url: cache || undefined
      };
    }
  }

  fetchCacheURL(raw: Optional<string>, size?: NeteaseImageSize, timeLimit?: number) {
    if (!raw) return undefined;
    const key = size ? this.setSize(raw, size) : raw;

    const result = this.cache[key];
    if (timeLimit && result && Date.now() - result.time > timeLimit) {
      delete this.cache[key];
      return undefined;
    }

    return result?.url || undefined;
  }

  private async clearCache() {
    const now = Date.now();
    const keys = Object.keys(this.cache);
    const removeItems: Set<string> = new Set();

    for (const key of keys) {
      const item = this.cache[key]!;
      if (now - item.time > this.timeLimit) {
        // 删除旧缓存
        item.url && removeItems.add(item.url);
        // 删除缓存
        delete this.cache[key];
      }
    }

    const cacheKeys = Object.keys(this.cache);
    if (cacheKeys.length > this.countLimit) {
      const sortedKeys = cacheKeys.sort((a, b) => {
        return this.cache[a]!.time - this.cache[b]!.time;
      });
      const removeCount = cacheKeys.length - this.countLimit;
      for (let i = 0; i < removeCount; i++) {
        const key = sortedKeys[i]!;
        const item = this.cache[key];
        // 删除旧缓存
        item?.url && removeItems.add(item.url);
        // 删除缓存
        delete this.cache[key];
      }
    }

    await this.cacheStore.removeMulti(Array.from(keys));
  }

  async loadCacheFromLocal() {
    setCloseTask("save_netease_image_cache", this.saveCacheToLocal.bind(this));
    const cache = await this.cacheStore.fetchObject<typeof this.cache>("netease_image_cache");
    if (cache) {
      this.cache = cache;
    }
    await this.clearCache();
  }

  async saveCacheToLocal() {
    await this.cacheStore.storeObject("netease_image_cache", this.cache);
  }
}

interface NeteaseImageClass extends WithStoreSnapshot {}

export const enum NeteaseImageSize {
  xs,
  sm,
  md,
  lg,
  raw
}

export const NeteaseImage = new NeteaseImageClass();

requestIdleCallback(
  () => {
    void NeteaseImage.loadCacheFromLocal();
  },
  { timeout: 5000 }
);
