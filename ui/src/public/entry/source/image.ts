import {
  NeteaseLocalImage,
  NeteaseNetworkImage,
  NeteaseTrack
} from "@mahiru/ui/public/models/netease";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

export default class _NeteaseImageSource {
  //region cache
  private static readonly cacheKey = "netease_image";

  private static getCacheKey(image: NeteaseNetworkImage) {
    const suffix = image.sourceName === "other" ? `_${image.url}` : "";
    return (
      _NeteaseImageSource.cacheKey +
      "_" +
      image.sourceID +
      "_" +
      image.sourceName +
      "_" +
      image.size +
      suffix
    );
  }

  private static storeCache(image: NeteaseNetworkImage) {
    return CacheStore.store.one(image.url, _NeteaseImageSource.getCacheKey(image));
  }

  private static getCache(image: NeteaseNetworkImage, download?: boolean) {
    if (download) {
      return CacheStore.check.orStoreOne(image.url, _NeteaseImageSource.getCacheKey(image));
    }
    return CacheStore.check.one(_NeteaseImageSource.getCacheKey(image));
  }
  //endregion

  static async try(image: NeteaseNetworkImage | NeteaseLocalImage, download: boolean) {
    if ("localURL" in image) return image;
    const check = await _NeteaseImageSource.getCache(image, download);
    if (check.ok) {
      return NeteaseLocalImage.fromNetworkImage(image, check.index.file);
    }
    return null;
  }

  static async local(track: NeteaseTrack, download: boolean, size: NeteaseImageSize) {
    return _NeteaseImageSource.try(
      NeteaseNetworkImage.fromTrackCover(track).setSize(size),
      download
    );
  }

  static notwork(track: NeteaseTrack, size: NeteaseImageSize) {
    return NeteaseNetworkImage.fromTrackCover(track).setSize(size);
  }

  static async download(image: NeteaseNetworkImage) {
    return _NeteaseImageSource.storeCache(image);
  }
}
