import { app } from "electron";
import { MainProtocol } from "@/inner/protocol";
import { MainExitCodeConstants } from "@/constants/exit-code";
import { Log } from "@/lib/log";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowManager } from "@/lib/window-manager";
import { MainTray } from "@/lib/tray";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainServices } from "@/services";
import { ipcInit } from "@/inner/ipc";
import { MainTaskBarCoverPreview } from "@/lib/taskbar-cover";

/**
 * @desc 应用实例 \
 * 管理服务编排，IPC注册，窗口管理，自定义协议等
 * */
export class MainApp {
  private _services?: MainServices;
  private _status: "initializing" | "running" | "exiting" = "initializing";

  /** @desc 是否进入退出流程 */
  private get isExiting() {
    return this._status === "exiting";
  }

  get services() {
    return this._services;
  }

  /**
   * @desc 创建并启动服务 \
   * error: exit \
   * code: MainExitCodeConstants.SERVICES_START_ERROR
   * */
  private createServices() {
    this._services = new MainServices({
      services: ["ncm", "proxy", "store"],
      onError: (service, msg, err) => {
        Log.error(`service(${service})`, msg, err);
        this.exit(
          MainExitCodeConstants.SERVICES_START_ERROR,
          `failed to initialize ${service} service`
        );
      }
    });
    return this._services.ready();
  }

  /**
   * @desc 注册自定义协议 \
   * error exit \
   * code MainExitCodeConstants.REGISTER_PROTOCOL_FAILED
   * */
  private registerAppProtocol() {
    try {
      MainProtocol.register();
    } catch (err) {
      Log.error("protocol", "failed to register app protocol", err);
      this.exit(MainExitCodeConstants.REGISTER_PROTOCOL_FAILED, "failed to register app protocol");
    }
  }

  /**
   * @desc 注册 IPC 处理函数 \
   * error： exit \
   * code： MainExitCodeConstants.REGISTER_IPC_HANDLERS_FAILED
   * */
  private registerIPCHandlers() {
    try {
      ipcInit();
    } catch (err) {
      Log.error("ipc", "failed to register ipc handlers", err);
      this.exit(
        MainExitCodeConstants.REGISTER_IPC_HANDLERS_FAILED,
        "failed to register ipc handlers"
      );
    }
  }

  /**
   * @desc 创建并显示主窗口 \
   * error: exit \
   * code: MainExitCodeConstants.LAUNCH_MAIN_RENDERER_FAILED
   * */
  private launchMainWindow() {
    try {
      const mainWindow = MainWindowCreator.create(MainWindowPreset.main);
      if (process.platform === "darwin") {
        mainWindow.addListener("close", (e) => {
          e.preventDefault();
          mainWindow.hide();
        });
        app.addListener("activate", () => {
          MainWindowManager.checkAndShow("main");
        });
      } else {
        mainWindow.addListener("closed", () => {
          this.exit(MainExitCodeConstants.NORMAL_EXIT, "");
        });
        app.addListener("window-all-closed", () => {
          this.exit(MainExitCodeConstants.NORMAL_EXIT, "");
        });
      }
      return mainWindow;
    } catch (err) {
      Log.error("window", "failed to launch main window", err);
      this.exit(MainExitCodeConstants.LAUNCH_MAIN_RENDERER_FAILED, "failed to launch main window");
    }
  }

  /**
   * @desc 注册系统托盘 \
   * error: log
   * */
  private registerAppTray() {
    try {
      MainTray.register();
    } catch (err) {
      Log.warn("tary", "failed to register app tray", err);
    }
  }

  /**
   * @desc 注册系统任务栏 \
   * error: log
   * */
  private registerTaskBar() {
    // 绑定主窗口；真正的注册会延迟到窗口首次显示之后（见 electron#9049）
    try {
      MainTaskBarCoverPreview.attach();
    } catch (err) {
      Log.warn("taskbar", "failed to register app taskbar", err);
    }
  }

  /**
   * @desc 停止所有服务
   * */
  private stopAllServers() {
    return Promise.allSettled(
      this._services?.services.map((s) => this._services?.stopService(s)) ?? []
    );
  }

  /** 输出信息 */
  private printInfo() {
    MainScreenResolver.printScreenInfo();
  }

  /** 当前状态 */
  get status() {
    return this._status;
  }

  /** 应用初始化，
   * @desc 按照顺序执行各个步骤，步骤失败会导致应用退出， \
   * 具体退出码和原因会根据失败的步骤不同而不同 \
   * 出现内部未被捕获的错误时，退出 code 为 MainExitCodeConstants.UNCAUGHT_ERROR
   * */
  init() {
    this.printInfo(); // 打印信息

    this._status = "initializing"; // 初始化状态
    Log.info("App initializing...");

    this.registerAppProtocol(); // 注册自定义应用协议
    if (this.isExiting) return;
    Log.info("App protocol registered");

    app
      .whenReady()
      .then(async () => {
        Log.info("App ready");

        // 绑定 AppUserModelID
        if (process.platform === "win32") {
          app.setAppUserModelId(process.env.APP_USER_MODEL_ID);
          Log.info(`App user model id is ${process.env.APP_USER_MODEL_ID}`);
        }

        this.registerIPCHandlers(); // 注册IPC
        if (this.isExiting) return;
        Log.info("App ipc handlers registered");

        await this.createServices(); // 创建服务
        if (this.isExiting) return;
        Log.info("App services created");

        this.launchMainWindow(); // 启动窗口
        if (this.isExiting) return;
        Log.info("App main window launched");

        this.registerAppTray(); // 注册托盘
        if (this.isExiting) return;
        Log.info("App tray registered");

        this.registerTaskBar(); // 注册任务栏
        if (this.isExiting) return;
        Log.info("App taskbar registered");

        this._status = "running"; // 修改状态，完成初始化
        Log.info("App running");
      })
      .catch((err) => {
        Log.error("app init", "failed to initialize app, uncaught error", err);
        this.exit(MainExitCodeConstants.UNCAUGHT_ERROR, "failed to initialize app, uncaught error");
      });
  }

  /** 应用退出
   * @desc 按照顺序执行各个步骤，步骤失败会记录日志，但不会阻止其他步骤的执行， \
   * 最终都会调用 app.exit(code) 退出应用 \
   * code为负数时是非正常退出，等于0为正常退出
   * */
  exit(code: number, reason: string) {
    if (this._status === "exiting") return;
    this._status = "exiting";

    // 异常退出输出错误日志
    if (code !== MainExitCodeConstants.NORMAL_EXIT) {
      Log.error("app exit", reason);
    }

    this.stopAllServers().finally(() => {
      app.exit(code);
    });
  }
}
