import { AddStoreSnapshot, WithStoreSnapshot } from "@mahiru/ui/store/decorator";

@AddStoreSnapshot
class NeteaseImageClass {
  cache: Record<string, { time: number; url?: string }> = {};

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

  async loadCacheFromLocal() {
    const cache = await this.cacheStore.fetchObject<typeof this.cache>("netease_image_cache");
    if (cache) {
      this.cache = cache;
    }
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

void NeteaseImage.loadCacheFromLocal();
