import { app } from "electron";
import { convertToLogLevel, Log } from "../utils/log";
import { isMacOS } from "../utils/platform";
import { Server } from "node:http";
import { commands } from "./commands";
import { registerAppEvents } from "./events";
import { registerSchemes } from "./protocol";
import { restartStoreServer, startStoreServer } from "../services/store";
import { createProxyServer } from "../services/express";
import { registerIpcMain } from "@mahiru/app/src/ipc/main";
import { startNeteaseMusicApiServer } from "../services/ncm";
import { printDevInfo, storeKeyAccessToken } from "../utils/dev";
import { LogLevel } from "@mahiru/log";
import { EqError } from "../utils/err";

export class APP {
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: ReturnType<typeof startNeteaseMusicApiServer>;
  proxyServer!: Server;
  cacheServer!: number;

  private init() {
    Log.debug("App initialize");
    this.cacheServer = startStoreServer({
      args: {
        port: process.env.GO_SERVER_PORT!,
        scheme: process.env.APP_SCHEME!,
        "scheme-hostname": "local",
        key: storeKeyAccessToken
      },
      log: convertToLogLevel(process.env.APP_LOG_LEVEL as EnvLogLevel) <= LogLevel.DEBUG,
      logger: (data) => Log.debug("store", data.toString()),
      exitHandler: () => {
        try {
          restartStoreServer();
        } catch (err) {
          Log.error(
            new EqError({
              raw: err,
              message: "failed to restart store server",
              label: "App init"
            })
          );
          app.quit();
        }
      }
    });
    this.proxyServer = createProxyServer();
    this.neteaseMusicAPIServer = startNeteaseMusicApiServer();
    this.willQuitAPP = !isMacOS;
    registerSchemes();
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
