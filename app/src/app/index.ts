import { app } from "electron";
import { Server } from "node:http";
import { LogLevel, ParseLogLevel } from "@mahiru/log";
import { Log } from "../utils/log";
import { isCreateMpris, isMacOS, isWindows } from "../utils/platform";
import { AppProtocol } from "./protocol";
import { isDev, printDevInfo, storeKeyAccessToken } from "../utils/dev";
import { storeServerBinaryPath } from "../utils/path";
import { AppTray, AppWindowCreator, AppWindowManager, AppWindows } from "../window";
import { registerEventHandlers, registerInvokeHandlers } from "../ipc/main";
import AppServices from "../services";
import Store from "@mahiru/store";

export { AppStore } from "./store";

export class APP {
  private static clearer = new Set<NormalFunc>();
  private storeService!: Store;
  private neteaseMusicApiService!: Promise<
    Awaited<ReturnType<typeof AppServices.NeteaseMusicApi.create>>
  >;
  private status: "initializing" | "running" | "exiting" = "initializing";
  private proxyServer?: Server;

  private init() {
    Log.info("App initializing...");
    this.status = "initializing";
    this.createServices();
    this.registerAppProtocol();
    app.addListener("ready", () => {
      Log.info("App ready");
      this.registerIPCHandlers();
      this.launchMainWindow();
      this.registerAppTray();
      this.status = "running";
    });
  }

  private createServices() {
    try {
      this.storeService = AppServices.Store.create({
        args: {
          port: process.env.GO_SERVER_PORT!,
          scheme: process.env.APP_SCHEME!,
          "scheme-hostname": process.env.APP_SCHEME_FILE_HOSTNAME!,
          key: storeKeyAccessToken
        },
        path: storeServerBinaryPath,
        enableConsole: ParseLogLevel(process.env.APP_LOG_LEVEL) <= LogLevel.DEBUG,
        logger: (data) => Log.debug("store service", data.toString()),
        onExit: (code) => {
          if (this.status === "exiting") return;
          AppWindows.fatalError(String(code));
          AppWindowManager.get("main")?.close();
          setTimeout(() => this.exit(), 5000);
        }
      });
      this.neteaseMusicApiService = AppServices.NeteaseMusicApi.create();
      !isDev && (this.proxyServer = AppServices.Proxy.create());
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to initialize app services",
        label: "App init"
      });
      app.exit(-1);
    }
  }

  private registerAppProtocol() {
    try {
      AppProtocol.register();
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to register app protocol",
        label: "App init"
      });
      app.exit(-2);
    }
  }

  private registerIPCHandlers() {
    try {
      registerInvokeHandlers();
      registerEventHandlers();
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to register ipc handlers",
        label: "App init"
      });
      app.exit(-3);
    }
  }

  private launchMainWindow() {
    try {
      const mainWindow = AppWindowCreator.create(AppWindows.main);
      mainWindow.addListener("close", (e) => {
        if (isMacOS) {
          e.preventDefault();
          mainWindow.hide();
        }
      });
      app.addListener("activate", () => {
        AppWindowManager.checkAndShow("main");
      });
      mainWindow.addListener("closed", () => {
        if (!isMacOS) this.exit();
      });
      app.addListener("window-all-closed", () => {
        if (!isMacOS) this.exit();
      });
      return mainWindow;
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to launch main window",
        label: "App init"
      });
      app.exit(-4);
    }
  }

  private registerAppTray() {
    try {
      AppTray.register();
    } catch (err) {
      Log.warn({
        raw: err,
        message: "failed to register app tray",
        label: "App init"
      });
    }
  }

  private async stopAllServers() {
    if (!isWindows) {
      Log.info("stopping store service by http (windows)");
      await this.storeService
        .stopByHttp(process.env.GO_SERVER_PORT!, storeKeyAccessToken)
        .catch((err) => Log.error(`failed to stop store service by http: ${err}`));
    }
    await this.storeService
      .stop()
      .catch((err) => Log.error(`failed to stop store service: ${err}`));
    await this.neteaseMusicApiService
      .then((ncm) => ncm?.server?.close())
      .catch((err) => Log.error(`failed to stop neteaseMusicAPIServer: ${err}`));
    this.proxyServer?.close();
  }

  private commands() {
    app.enableSandbox();
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
    if (this.status === "exiting") return;
    this.status = "exiting";
    Log.info("app exiting...");
    Promise.allSettled([this.stopAllServers()]).finally(() => {
      this.cleanup();
      Log.info("app exited.");
      app.exit(0);
    });
  }

  run() {
    this.commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      printDevInfo();
      this.init();
    } else {
      app.exit(0);
    }
  }

  static addClearer(cb: NormalFunc) {
    this.clearer.add(cb);
  }
}
