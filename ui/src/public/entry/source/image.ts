import {
  NeteaseLocalImage,
  NeteaseNetworkImage
} from "@mahiru/ui/public/models/netease/NeteaseImage";
import { CacheStore } from "@mahiru/ui/public/store/cache";
import NeteaseTrack from "@mahiru/ui/public/models/netease/NeteaseTrack";

export default class NeteaseImageSource {
  //region cache
  private static readonly cacheKey = "netease_image";

  private static getCacheKey(image: NeteaseNetworkImage) {
    return (
      NeteaseImageSource.cacheKey + "_" + image.sourceID + "_" + image.sourceName + "_" + image.size
    );
  }

  private static storeCache(image: NeteaseNetworkImage) {
    return CacheStore.store.one(image.url, NeteaseImageSource.getCacheKey(image));
  }

  private static getCache(image: NeteaseNetworkImage, download?: boolean) {
    if (download) {
      return CacheStore.check.orStoreOne(image.url, NeteaseImageSource.getCacheKey(image));
    }
    return CacheStore.check.one(NeteaseImageSource.getCacheKey(image));
  }
  //endregion

  static async try(image: NeteaseNetworkImage, download: boolean) {
    const check = await NeteaseImageSource.getCache(image, download);
    if (check.ok) {
      return NeteaseLocalImage.fromNetworkImage(image, check.index.file);
    }
    return null;
  }

  static async tryFromTrack(track: NeteaseTrack, download: boolean) {
    return NeteaseImageSource.try(NeteaseNetworkImage.fromTrackCover(track), download);
  }

  static async downloadImage(image: NeteaseNetworkImage) {
    return NeteaseImageSource.storeCache(image);
  }
}
