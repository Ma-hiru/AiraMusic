import { MainApp } from "@/entry";
import { MainStoreConfig } from "@/lib/key-value-store";
import { MainCacheStoreConstants } from "@/constants/store";

export class MainHandle {
  private static app: Nullable<Readonly<MainApp>> = null;
  // ipc更新config时会重新赋值
  static allowedPath = MainStoreConfig.get("cache", MainCacheStoreConstants.DEFAULT_CONFIG).path;
  static allowedOrigin = [
    "file://",
    "http://localhost:",
    "http://127.0.0.1:",
    `${process.env.APP_SCHEME}://`,
    `https://github.com/Ma-hiru`
  ];

  static isTrustedOrigin(url: string) {
    for (const allowed of MainHandle.allowedOrigin) {
      if (url.startsWith(allowed)) {
        return true;
      }
    }
    return false;
  }

  static save(instance: Readonly<MainApp>) {
    MainHandle.app = instance;
  }

  static get() {
    return MainHandle.app;
  }
}
