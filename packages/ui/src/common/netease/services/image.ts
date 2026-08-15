import { Log } from "@/common/lib/log";
import { RendererCache } from "@/common/lib/cache";
import { LRUCacheWithTime } from "@/common/utils/lru";
import { StoreCategory, NeteaseImageSize } from "@/common/enum";
import { NeteaseTrack, NeteaseLocalImage, NeteaseNetworkImage } from "@/common/netease/models";

interface LocalFn {
  (
    image: NeteaseLocalImage | NeteaseNetworkImage,
    download: boolean
  ): Promise<null | NeteaseLocalImage>;
  (
    track: NeteaseTrack,
    download: boolean,
    size: NeteaseImageSize
  ): Promise<null | NeteaseLocalImage>;
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
    return RendererCache.service.save.url([
      {
        url: image.url,
        id: _NeteaseImageSource.getCacheKey(image),
        category: StoreCategory.Image
      }
    ]);
  }

  private static setMemoryCache(image: NeteaseLocalImage) {
    _NeteaseImageSource.memoryCache.set(_NeteaseImageSource.getCacheKey(image), image);
    return image;
  }

  private static getCache(image: NeteaseNetworkImage, download?: boolean) {
    const cache = _NeteaseImageSource.memoryCache.get(_NeteaseImageSource.getCacheKey(image));
    if (cache) {
      Log.debug("image cache hit");
      return Promise.resolve({ code: 201, data: cache } as const);
    }
    if (download) {
      return RendererCache.service.check.readOrStoreOne({
        url: image.url,
        id: _NeteaseImageSource.getCacheKey(image),
        category: StoreCategory.Image
      });
    }
    return RendererCache.service.check.readOne({ id: _NeteaseImageSource.getCacheKey(image) });
  }

  private static removeCache(image: NeteaseNetworkImage) {
    _NeteaseImageSource.memoryCache.delete(_NeteaseImageSource.getCacheKey(image));
    return RendererCache.service.read.remove([_NeteaseImageSource.getCacheKey(image)]);
  }
  //endregion

  private static async localImage(
    image: NeteaseLocalImage | NeteaseNetworkImage,
    download: boolean
  ) {
    if ("localURL" in image) return image;
    const check = await _NeteaseImageSource.getCache(image, download);
    if (check.code === 201) {
      return check.data;
    }
    if (check.code === 200 && check.data.ok) {
      return _NeteaseImageSource.setMemoryCache(
        NeteaseLocalImage.fromNetworkImage(
          image,
          RendererCache.service.read.build(check.data.idx.id)
        )
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
      ...(args as unknown as [NeteaseLocalImage | NeteaseNetworkImage, boolean])
    );
  }) as LocalFn;

  static notwork(track: NeteaseTrack, size: NeteaseImageSize) {
    return NeteaseNetworkImage.fromTrackCover(track).setSize(size);
  }

  static remove(image: NeteaseLocalImage | NeteaseNetworkImage) {
    return this.removeCache(image);
  }

  private static preloadedRecord = new Set<string>();
  static preload(images: NeteaseNetworkImage[]) {
    const items = [];
    for (const image of images) {
      const id = _NeteaseImageSource.getCacheKey(image);
      if (!_NeteaseImageSource.preloadedRecord.has(id)) {
        _NeteaseImageSource.preloadedRecord.add(id);
        items.push({
          id,
          url: image.url,
          category: StoreCategory.Image
        });
      }
    }
    void RendererCache.service.check.readOrStore(items);
  }

  static async download(image: NeteaseNetworkImage) {
    return _NeteaseImageSource.downloadCache(image);
  }
}
