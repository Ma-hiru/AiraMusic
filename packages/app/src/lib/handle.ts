import { MainApp } from "@/entry";
import { MainStoreConfig } from "@/lib/key-value-store";
import { MainCacheStoreConstants } from "@/constants/store";

export class MainHandle {
  private static app: Nullable<Readonly<MainApp>> = null;
  static allowedPath = MainStoreConfig.get("cache", MainCacheStoreConstants.DEFAULT_CONFIG).path;

  static save(instance: Readonly<MainApp>) {
    MainHandle.app = instance;
  }

  static get() {
    return MainHandle.app;
  }
}
