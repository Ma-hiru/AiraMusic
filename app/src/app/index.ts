import { app } from "electron";
import { Server } from "node:http";
import { LogLevel, ParseLogLevel } from "@mahiru/log";
import { Log } from "../utils/log";
import { isCreateMpris } from "../utils/platform";
import { AppProtocol } from "./protocol";
import { restartStoreServer, startStoreServer, stopStoreServer } from "../services/store";
import { createProxyServer } from "../services/proxy";
import { createNeteaseMusicApiServer } from "../services/ncm";
import { printDevInfo, storeKeyAccessToken } from "../utils/dev";
import { EqError } from "../utils/err";
import { storeServerBinaryPath } from "../utils/path";
import { AppTray, AppWindowCreator, AppWindows } from "../window";
import { registerEventHandlers, registerInvokeHandlers } from "../ipc/main";

export { AppStore } from "./store";

export class APP {
  private static clearer = new Set<NormalFunc>();
  private exiting = false;
  private neteaseMusicAPIServer!: ReturnType<typeof createNeteaseMusicApiServer>;
  private proxyServer?: Server;

  private init() {
    Log.debug("App initializing...");
    this.createStoreServer();
    this.proxyServer = createProxyServer();
    this.neteaseMusicAPIServer = createNeteaseMusicApiServer();
    AppProtocol.register();
    app.addListener("ready", () => {
      Log.debug("App ready");

      registerInvokeHandlers();
      registerEventHandlers();

      AppWindowCreator.create(AppWindows.main).addListener("closed", this.exit.bind(this));
      AppTray.register();
    });
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

    try {
      return startStoreServer({
        args,
        exitHandler,
        path: storeServerBinaryPath,
        log: ParseLogLevel(process.env.APP_LOG_LEVEL) <= LogLevel.DEBUG,
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
    return new Promise<void>((resolve) => {
      stopStoreServer();
      this.proxyServer?.close();
      this.neteaseMusicAPIServer
        .then((ncm) => {
          Log.debug("stop neteaseMusicAPIServer");
          ncm?.server?.close();
        })
        .catch((err) => {
          Log.debug(`failed to stop neteaseMusicAPIServer: ${err}`);
        })
        .finally(resolve);
    });
  }

  private commands() {
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
    if (isCreateMpris) {
      app.commandLine.appendSwitch(
        "enable-features",
        "HardwareMediaKeyHandling,MediaSessionService"
      );
    }
    app.commandLine.appendSwitch("enable-zero-copy");
  }

  private cleanup() {
    APP.clearer.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        try {
          Log.error(err);
        } catch {
          console.log(err);
        }
      }
    });
  }

  exit() {
    if (this.exiting) return;
    this.exiting = true;
    Log.debug("app exiting...");
    setTimeout(() => {
      Promise.allSettled([this.stopAllServers()]).finally(() => {
        this.cleanup();
        Log.debug("app exited.");
        app.exit();
      });
    }, 2500);
  }

  run() {
    this.commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      printDevInfo();
      this.init();
    } else {
      app.quit();
    }
  }

  static addClearer(cb: NormalFunc) {
    this.clearer.add(cb);
  }
}
