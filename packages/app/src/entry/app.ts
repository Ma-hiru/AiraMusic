import { app } from "electron";
import { Log } from "../utils/log";
import { AppProtocol } from "../inner/protocol";
import { LogLevel } from "@mahiru/log";
import { isMacOS, isWindows } from "../utils/platform";
import { isDev, storeKeyAccessToken } from "../utils/dev";
import { storeServerBinaryPath } from "../utils/path";
import { AppTray, AppWindowCreator, AppWindowManager, AppWindows } from "../window";
import AppIpcMain from "../inner/ipc/main";
import AppServices from "../services";
import AppScreen from "../utils/screen";

export class APP {
  private proxyServer?: ReturnType<typeof AppServices.Proxy.create>;
  private storeService?: ReturnType<typeof AppServices.Store.create>;
  private neteaseMusicApiService?: ReturnType<typeof AppServices.NeteaseMusicApi.create>;
  private status: "initializing" | "running" | "exiting" = "initializing";

  /** @desc 是否进入退出流程 */
  private get isExiting() {
    return this.status === "exiting";
  }

  /**
   * @desc 创建并启动服务 \
   * error: exit \
   * code: -1
   * */
  private createServices() {
    try {
      const handleLaunchError = (err: Error, name: string) => {
        if (this.status === "exiting") return;
        Log.error(err);
        AppWindows.fatalError(err.message);
        AppWindowManager.get("main")?.close();
        setTimeout(
          () => this.exit(-1, `Failed to initialize ${name} service: ${err.message}`),
          5000
        );
      };

      this.storeService = AppServices.Store.create({
        args: {
          port: process.env.GO_SERVER_PORT!,
          scheme: process.env.APP_SCHEME!,
          "scheme-hostname": process.env.APP_SCHEME_FILE_HOSTNAME!,
          key: storeKeyAccessToken
        },
        path: storeServerBinaryPath,
        enableConsole: Log.EnvLevel <= LogLevel.DEBUG,
        logger: (data) => Log.debug("store service", data.toString()),
        onExit: (code) => {
          handleLaunchError(new Error(`store service exited with code ${code}`), "store");
        }
      });

      this.neteaseMusicApiService = AppServices.NeteaseMusicApi.create((err) =>
        handleLaunchError(err, "Netease Music API")
      );

      !isDev &&
        (this.proxyServer = AppServices.Proxy.create((err) => handleLaunchError(err, "Proxy")));
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to initialize app services",
        label: "App init"
      });
      this.exit(
        -1,
        "Failed to initialize app services, reason: " +
          (err instanceof Error ? err.message : String(err))
      );
    }
  }

  /**
   * @desc 注册自定义协议 \
   * error exit \
   * code -2
   * */
  private registerAppProtocol() {
    try {
      AppProtocol.register();
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to register app protocol",
        label: "App init"
      });
      this.exit(-2, "Failed to register app protocol");
    }
  }

  /**
   * @desc 注册 IPC 处理函数 \
   * error： exit \
   * code： -3
   * */
  private registerIPCHandlers() {
    try {
      AppIpcMain.registerEventHandlers();
      AppIpcMain.registerInvokeHandlers();
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to register ipc handlers",
        label: "App init"
      });
      this.exit(-3, "Failed to register ipc handlers");
    }
  }

  /**
   * @desc 创建并显示主窗口 \
   * error: exit \
   * code: -4
   * */
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
        if (!isMacOS) this.exit(0, "Main window closed");
      });
      app.addListener("window-all-closed", () => {
        if (!isMacOS) this.exit(0, "All windows closed");
      });
      return mainWindow;
    } catch (err) {
      Log.error({
        raw: err,
        message: "failed to launch main window",
        label: "App init"
      });
      this.exit(-4, "Failed to launch main window");
    }
  }

  /**
   * @desc 注册系统托盘 \
   * error: log
   * */
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

  /**
   * @desc 停止所有服务
   * */
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

  private printInfo() {
    AppScreen.printScreenInfo();
  }

  /** 应用初始化，
   * @desc 按照顺序执行各个步骤，步骤失败会导致应用退出， \
   * 具体退出码和原因会根据失败的步骤不同而不同 \
   * 出现内部未被捕获的错误时，退出 code 为-5
   * */
  init() {
    this.printInfo(); // 打印信息

    this.status = "initializing"; // 初始化状态
    Log.info("App initializing...");

    this.registerAppProtocol(); // 注册自定义应用协议
    if (this.isExiting) return;
    Log.info("App protocol registered");

    app
      .whenReady()
      .then(() => {
        Log.info("App ready");

        this.createServices(); // 创建服务
        if (this.isExiting) return;
        Log.info("App services created");

        this.registerIPCHandlers(); // 注册IPC
        if (this.isExiting) return;
        Log.info("App ipc handlers registered");

        this.launchMainWindow(); // 启动窗口
        if (this.isExiting) return;
        Log.info("App main window launched");

        this.registerAppTray(); // 注册托盘
        if (this.isExiting) return;
        Log.info("App tray registered");

        this.status = "running"; // 修改状态，完成初始化
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

  /** 应用退出
   * @desc 按照顺序执行各个步骤，步骤失败会记录日志，但不会阻止其他步骤的执行， \
   * 最终都会调用 app.exit(code) 退出应用 \
   * code为负数时是非正常退出，等于0为正常退出
   * */
  exit(code = 0, reason: string) {
    if (this.status === "exiting") return;
    this.status = "exiting";
    Log.info("app exiting, reason: " + reason);
    Promise.allSettled([this.stopAllServers()]).finally(() => {
      Log.info("app exited.");
      app.exit(code);
    });
  }
}
