import ElectronStore from "electron-store";
import { isCreateMpris, isMacOS } from "../utils/platform";
import { Log } from "../utils/log";
import { app, BrowserWindow, protocol } from "electron";
import { startNeteaseMusicApiServer } from "../services/ncm";
import { Server } from "node:http";
import { createExpressApp } from "../services/express";
import { handleAppEvents } from "./appEvent";
import { startCacheServer } from "@mahiru/app/src/services/cache";

export type StoreType = {
  window: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  settings: {
    closeAppOption: "ask" | "exit";
  };
};

export class APP {
  store!: ElectronStore<StoreType>;
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: Promise<void>;
  expressAPP!: Server;
  window!: BrowserWindow;
  cacheAPP!: number;

  private init() {
    Log.debug("App initialize");
    this.willQuitAPP = !isMacOS;
    this.store = new ElectronStore<StoreType>({
      defaults: {
        window: {
          width: 0,
          height: 0,
          x: 0,
          y: 0
        },
        settings: {
          closeAppOption: "ask"
        }
      }
    });
    this.neteaseMusicAPIServer = startNeteaseMusicApiServer();
    this.expressAPP = createExpressApp();
    this.cacheAPP = startCacheServer();
    protocol.registerSchemesAsPrivileged([
      {
        scheme: "app",
        privileges: {
          secure: true,
          standard: true
        }
      }
    ]);
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
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      this.init();
    } else {
      app.quit();
    }
  }
}
