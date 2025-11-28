import ElectronStore from "electron-store";
import { isCreateMpris, isMacOS } from "../utils/platform";
import { Log } from "../utils/log";
import { app, BrowserWindow } from "electron";
import { startNeteaseMusicApiServer } from "../services/ncm";
import { Server } from "node:http";
import { createExpressApp } from "../services/express";
import { handleAppEvents } from "./appEvent";
import { startCacheServer } from "../services/store";
import { commands } from "./cmd";
import { StoreType, Store } from "./store";

export class APP {
  store!: ElectronStore<StoreType>;
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: Promise<void>;
  expressAPP!: Server;
  window!: BrowserWindow;
  cacheAPP!: number;

  private init() {
    Log.debug("App initialize");
    this.cacheAPP = startCacheServer([
      "--port",
      process.env.GO_SERVER_PORT!,
      "--scheme",
      process.env.APP_SCHEME!
    ]);
    this.expressAPP = createExpressApp();
    this.neteaseMusicAPIServer = startNeteaseMusicApiServer();
    this.store = Store;
    this.willQuitAPP = !isMacOS;
    handleAppEvents(this);

    // disable chromium mpris
    if (isCreateMpris) {
      app.commandLine.appendSwitch(
        "enable-features",
        "HardwareMediaKeyHandling,MediaSessionService"
      );
    }
  }

  run() {
    commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      this.init();
    } else {
      app.quit();
    }
  }
}
