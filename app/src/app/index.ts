import { isMacOS } from "../utils/platform";
import { Log } from "../utils/log";
import { app, BrowserWindow } from "electron";
import { startNeteaseMusicApiServer } from "../services/ncm";
import { Server } from "node:http";
import { createExpressApp } from "../services/express";
import { handleAppEvents } from "./events";
import { startCacheServer } from "../services/store";
import { commands } from "./cmd";
import { registerAppProtocol } from "./protocol";

export class APP {
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: ReturnType<typeof startNeteaseMusicApiServer>;
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
    this.willQuitAPP = !isMacOS;
    registerAppProtocol();
    handleAppEvents(this);
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
