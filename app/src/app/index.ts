import { app } from "electron";
import { Server } from "node:http";
import { LogLevel, LogLevelFromString } from "@mahiru/log";
import { Log } from "../utils/log";
import { isMacOS } from "../utils/platform";
import { commands } from "./commands";
import { registerAppEvents } from "./events";
import { registerSchemes } from "./protocol";
import { restartStoreServer, startStoreServer, stopStoreServer } from "../services/store";
import { createProxyServer } from "../services/express";
import { registerIpcMain } from "../ipc/main";
import { createNeteaseMusicApiServer } from "../services/ncm";
import { printDevInfo, storeKeyAccessToken } from "../utils/dev";
import { EqError } from "../utils/err";
import { Store } from "./store";
import { typedIpcMainSendMessage } from "../ipc/main/typed";
import { storeServerBinaryPath } from "../utils/path";

export class APP {
  willQuitAPP!: boolean;
  neteaseMusicAPIServer!: ReturnType<typeof createNeteaseMusicApiServer>;
  proxyServer!: Server;
  cacheServer!: number;

  private init() {
    Log.debug("App initialize");
    this.cacheServer = this.createStoreServer();
    this.proxyServer = createProxyServer();
    this.neteaseMusicAPIServer = createNeteaseMusicApiServer();
    this.willQuitAPP = !isMacOS;
    registerSchemes();
    registerIpcMain();
    registerAppEvents(this);
  }

  private createStoreServer() {
    const args: Record<string, string | number> = {
      port: process.env.GO_SERVER_PORT!,
      scheme: process.env.APP_SCHEME!,
      "scheme-hostname": process.env.APP_SCHEME_FILE_HOSTNAME!,
      key: storeKeyAccessToken
    };
    const exitHandler = () => {
      try {
        restartStoreServer(false);
      } catch (err) {
        Log.error(
          new EqError({
            raw: err,
            message: "failed to restart store server",
            label: "App init"
          })
        );
        this.exit();
      }
    };
    const path = Store.get("settings").storePath;

    if (path) args["path"] = path;

    try {
      return startStoreServer({
        args,
        exitHandler,
        path: storeServerBinaryPath,
        log: LogLevelFromString(process.env.APP_LOG_LEVEL) <= LogLevel.DEBUG,
        logger: (data) => Log.debug("store", data.toString())
      });
    } catch (err) {
      Log.error(
        new EqError({
          raw: err,
          message: "failed to start store server",
          label: "App init"
        })
      );
      app.exit();
      return -1;
    }
  }

  private async stopAllServers() {
    Log.debug("stop all servers");
    return new Promise((resolve) => {
      stopStoreServer();
      this.proxyServer.close();
      this.neteaseMusicAPIServer
        .then((ncm) => {
          Log.debug("stop neteaseMusicAPIServer");
          ncm?.server?.close();
        })
        .catch((err) => {
          Log.debug(`failed to stop neteaseMusicAPIServer: ${err}`);
        });
      setTimeout(resolve, 5000);
    });
  }

  private exiting = false;

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    Log.debug("app exiting...");
    typedIpcMainSendMessage({
      sender: "main",
      receiver: "main",
      type: "mainProcessExit",
      data: undefined
    });
    Promise.allSettled([this.stopAllServers()]).finally(() => {
      Log.debug("app exited.");
      app.exit();
    });
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
