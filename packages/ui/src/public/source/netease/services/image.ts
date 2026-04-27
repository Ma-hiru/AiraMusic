import {
  NeteaseLocalImage,
  NeteaseNetworkImage,
  NeteaseTrack
} from "@mahiru/ui/public/source/netease/models";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { LRUCacheWithTime } from "@mahiru/ui/public/utils/lru";
import { Log } from "@mahiru/ui/public/utils/dev";

interface LocalFn {
  (
    image: NeteaseNetworkImage | NeteaseLocalImage,
    download: boolean
  ): Promise<NeteaseLocalImage | null>;
  (
    track: NeteaseTrack,
    download: boolean,
    size: NeteaseImageSize
  ): Promise<NeteaseLocalImage | null>;
}

export default class _NeteaseImageSource {
  //region cache
  private static readonly cacheKey = "netease_image";
  private static readonly memoryCache = new LRUCacheWithTime<string, NeteaseLocalImage>(
    1500,
    1000 * 60 * 60 * 24
  );

  private static getCacheKey(image: NeteaseNetworkImage) {
    const suffix = image.sourceName === "other" ? image.url : "";
    return `${_NeteaseImageSource.cacheKey}_${image.sourceName}_${image.sourceID}_${image.size}_${image.cacheKey ?? ""}_${suffix}`;
  }

  private static downloadCache(image: NeteaseNetworkImage) {
    return CacheStore.local.store.one(image.url, _NeteaseImageSource.getCacheKey(image));
  }

  private static setMemoryCache(image: NeteaseLocalImage) {
    _NeteaseImageSource.memoryCache.set(_NeteaseImageSource.getCacheKey(image), image);
    return image;
  }

  private static getCache(image: NeteaseNetworkImage, download?: boolean) {
    const cache = _NeteaseImageSource.memoryCache.get(_NeteaseImageSource.getCacheKey(image));
    if (cache) {
      Log.debug("image cache hit");
      return Promise.resolve({ ok: true, image: cache });
    }
    if (download) {
      return CacheStore.local.check.orStoreOne(image.url, _NeteaseImageSource.getCacheKey(image));
    }
    return CacheStore.local.check.one(_NeteaseImageSource.getCacheKey(image));
  }

  private static removeCache(image: NeteaseNetworkImage) {
    _NeteaseImageSource.memoryCache.delete(_NeteaseImageSource.getCacheKey(image));
    return CacheStore.local.remove.one(_NeteaseImageSource.getCacheKey(image));
  }
  //endregion

  private static async localImage(
    image: NeteaseNetworkImage | NeteaseLocalImage,
    download: boolean
  ) {
    if ("localURL" in image) return image;
    const check = await _NeteaseImageSource.getCache(image, download);
    if (check.ok) {
      if ("image" in check) return check.image;
      return _NeteaseImageSource.setMemoryCache(
        NeteaseLocalImage.fromNetworkImage(image, check.index.file)
      );
    }
    return null;
  }

  private static async localTrack(track: NeteaseTrack, download: boolean, size: NeteaseImageSize) {
    return _NeteaseImageSource.localImage(
      NeteaseNetworkImage.fromTrackCover(track).setSize(size),
      download
    );
  }

  static readonly local = ((...args) => {
    if (args.length === 3) {
      return _NeteaseImageSource.localTrack(...(args as [NeteaseTrack, boolean, NeteaseImageSize]));
    }
    return _NeteaseImageSource.localImage(
      ...(args as unknown as [NeteaseNetworkImage | NeteaseLocalImage, boolean])
    );
  }) as LocalFn;

  static notwork(track: NeteaseTrack, size: NeteaseImageSize) {
    return NeteaseNetworkImage.fromTrackCover(track).setSize(size);
  }

  static remove(image: NeteaseNetworkImage | NeteaseLocalImage) {
    return this.removeCache(image);
  }

  static async download(image: NeteaseNetworkImage) {
    return _NeteaseImageSource.downloadCache(image);
  }
}
