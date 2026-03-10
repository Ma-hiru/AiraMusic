import {
  NeteaseLocalImage,
  NeteaseNetworkImage
} from "@mahiru/ui/public/models/netease/NeteaseImage";
import { CacheStore } from "@mahiru/ui/public/store/cache";

export default class NeteaseImageSource {
  //region cache
  private static readonly cacheKey = "netease_image";

  private static getCacheKey(props: {
    sourceID: number | string;
    sourceName: string;
    size: number;
  }) {
    return (
      NeteaseImageSource.cacheKey + "_" + props.sourceID + "_" + props.sourceName + "_" + props.size
    );
  }

  private static storeCache(props: {
    sourceID: number | string;
    sourceName: string;
    size: number;
    url: string;
  }) {
    return CacheStore.store.one(props.url, NeteaseImageSource.getCacheKey(props));
  }

  private static getCache(
    props: {
      sourceID: number | string;
      sourceName: string;
      size: number;
    },
    download?: boolean
  ) {
    if (download) {
      return CacheStore.check.orStoreOne(NeteaseImageSource.getCacheKey(props));
    } else {
      return CacheStore.check.one(NeteaseImageSource.getCacheKey(props));
    }
  }
  //endregion

  static async tryFromImage(image: NeteaseNetworkImage, download: boolean) {
    const check = await NeteaseImageSource.getCache(image, download);
    if (check.ok) {
      return NeteaseLocalImage.fromNetworkImage(image, check.index.file);
    }
    return null;
  }

  static async downloadImage(image: NeteaseNetworkImage) {
    return NeteaseImageSource.storeCache(image);
  }
}
