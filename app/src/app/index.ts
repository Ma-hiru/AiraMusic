import { app } from "electron";
import { Log } from "../utils/log";
import { isMacOS } from "../utils/platform";
import { Server } from "node:http";
import { commands } from "./commands";
import { registerAppEvents } from "./events";
import { registerProtocol } from "./protocol";
import { startCacheServer } from "../services/store";
import { createProxyServer } from "../services/express";
import { registerIpcMain } from "@mahiru/app/src/ipc/main";
import { startNeteaseMusicApiServer } from "../services/ncm";
import { printDevInfo } from "../utils/dev";

export class APP {
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: ReturnType<typeof startNeteaseMusicApiServer>;
  proxyServer!: Server;
  cacheServer!: number;

  private init() {
    Log.debug("App initialize");
    this.cacheServer = startCacheServer();
    this.proxyServer = createProxyServer();
    this.neteaseMusicAPIServer = startNeteaseMusicApiServer();
    this.willQuitAPP = !isMacOS;
    registerProtocol();
    registerIpcMain();
    registerAppEvents(this);
  }

  run() {
    commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      printDevInfo();
      this.init();
    } else {
      app.quit();
    }
  }
}
