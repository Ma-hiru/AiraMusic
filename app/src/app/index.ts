import { app } from "electron";
import { Server } from "node:http";
import { EqError, LogLevel, ParseLogLevel } from "@mahiru/log";
import { Log } from "../utils/log";
import { isMacOS, isWindows } from "../utils/platform";
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
  private proxyServer?: Server;
  private storeService?: Store;
  private neteaseMusicApiService?: ReturnType<typeof AppServices.NeteaseMusicApi.create>;
  private status: "initializing" | "running" | "exiting" = "initializing";

  private get isExiting() {
    return this.status === "exiting";
  }

  private init() {
    this.status = "initializing";
    Log.info("App initializing...");

    this.registerAppProtocol();
    if (this.isExiting) return;
    Log.info("App protocol registered");

    app
      .whenReady()
      .then(() => {
        Log.info("App ready");

        this.createServices();
        if (this.isExiting) return;
        Log.info("App services created");

        this.registerIPCHandlers();
        if (this.isExiting) return;
        Log.info("App ipc handlers registered");

        this.launchMainWindow();
        if (this.isExiting) return;
        Log.info("App main window launched");

        this.registerAppTray();
        if (this.isExiting) return;
        Log.info("App tray registered");

        this.status = "running";
        Log.info("App running");
      })
      .catch((err) => {
        Log.error({
          raw: err,
          message: "failed to initialize app, uncaught error",
          label: "App init"
        });
        app.exit(-5);
      });
  }

  private createServices() {
    try {
      const handleLaunchError = (source: unknown) => {
        if (this.status === "exiting") return;
        const err = EqError.anyToError(source) || new Error(String(source));
        Log.error(err);
        AppWindows.fatalError(err.message, err.stack);
        AppWindowManager.get("main")?.close();
        setTimeout(() => this.exit(-1), 5000);
      };
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
          handleLaunchError(new Error(`store service exited with code ${code}`));
        }
      });
      this.neteaseMusicApiService = AppServices.NeteaseMusicApi.create(handleLaunchError).catch((err) => {
        handleLaunchError(err);
        return null;
      });
      !isDev && (this.proxyServer = AppServices.Proxy.create(handleLaunchError));
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to initialize app services",
        label: "App init"
      });
      this.exit(-1);
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
      this.exit(-2);
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
      this.exit(-3);
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
      this.exit(-4);
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
    if (isWindows) {
      Log.info("stopping store service by http (windows)");
      await this.storeService
        ?.stopByHttp(process.env.GO_SERVER_PORT!, storeKeyAccessToken)
        .catch((err) => Log.error(`failed to stop store service by http: ${err}`));
    }
    await this.storeService
      ?.stop()
      .catch((err) => Log.error(`failed to stop store service: ${err}`));
    await this.neteaseMusicApiService
      ?.then((ncm) => ncm?.server?.close())
      .catch((err) => Log.error(`failed to stop neteaseMusicAPIServer: ${err}`));
    this.proxyServer?.close();
  }

  private commands() {
    app.enableSandbox();
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
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

  exit(code = 0) {
    if (this.status === "exiting") return;
    this.status = "exiting";
    Log.info("app exiting...");
    Promise.allSettled([this.stopAllServers()]).finally(() => {
      this.cleanup();
      Log.info("app exited.");
      app.exit(code);
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
