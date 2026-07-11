import { MainPathResolver } from "@/lib/path-resolver";
import type { CacheStoreConfig } from "@/types/store";

export class MainCacheStoreConstants {
  static readonly DEFAULT_CONFIG: CacheStoreConfig = {
    capacity: 5 * 1024 ** 3,
    path: MainPathResolver.appUserDataJoin("cache"),
    ttl: 7 * 24 + "h"
  };
}
