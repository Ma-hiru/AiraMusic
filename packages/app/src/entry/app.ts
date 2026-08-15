import { readFileSync } from "node:fs";
import { app, session } from "electron";
import { X509Certificate } from "node:crypto";
import { Log } from "@/lib/log";
import { ipcInit } from "@/inner/ipc";
import { MainTray } from "@/lib/tray";
import { MainAgent } from "@/inner/agent";
import { MainServices } from "@/services";
import { MainIPC } from "@mahiru/ipc/main";
import { MainMcp } from "@/inner/mcp/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowPreset } from "@/lib/window-preset";
import { MainWindowCreator } from "@/lib/window-creator";
import { MainWindowManager } from "@/lib/window-manager";
import { MainScreenResolver } from "@/lib/screen-resolver";
import { MainExitCodeConstants } from "@/constants/exit-code";
import { MainTaskBarCoverPreview } from "@/lib/taskbar-cover";
import { MainAgentFeatureSettings } from "@/inner/agent/feature-settings";

/**
 * @desc 应用实例 \
 * 管理服务编排，IPC注册，窗口管理，自定义协议等
 * */
export class MainApp {
  private _services?: MainServices;
  private _status: "exiting" | "running" | "initializing" = "initializing";

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
   * @desc 注册自定义协议
   * @deprecated
   * error exit \
   * code MainExitCodeConstants.REGISTER_PROTOCOL_FAILED
   * */
  private registerAppProtocol() {
    try {
      // MainProtocol.register();
    } catch (err) {
      Log.error("protocol", "failed to register app protocol", err);
      this.exit(MainExitCodeConstants.REGISTER_PROTOCOL_FAILED, "failed to register app protocol");
    }
  }

  /**
   * @desc 信任本地 HTTPS 代理的自签证书 \
   * 仅对 localhost / 127.0.0.1 生效，其余主机回退 Chromium 默认校验（callback(-3)）。 \
   * 回环地址无法被网络侧中间人劫持，指纹不匹配时拒绝，避免信任错误的证书
   * */
  private trustLocalProxyCertificate() {
    try {
      const cert = new X509Certificate(readFileSync(MainPathResolver.localhostCertPath));
      const fingerprint = cert.fingerprint256;

      session.defaultSession.setCertificateVerifyProc((request, callback) => {
        const isLoopback =
          request.hostname === "localhost" || request.hostname === "127.0.0.1";
        if (!isLoopback) return callback(-3);
        // Electron 的 certificate.fingerprint 是 "sha256/"+Base64 的 pin 格式，
        // 与 Node 的冒号分隔 hex 不可比，统一从 PEM 数据（certificate.data）重算。
        const peerData = request.certificate?.data;
        if (!peerData) return callback(0); // 数据缺失时不拒绝，回环上风险可忽略
        try {
          const peer = new X509Certificate(peerData);
          return callback(peer.fingerprint256 === fingerprint ? 0 : -3);
        } catch {
          return callback(-3);
        }
      });
      Log.info("cert", "trusted local proxy certificate for localhost/127.0.0.1");
    } catch (err) {
      Log.warn("cert", "failed to trust local proxy certificate", err);
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

      let isQuitting = false;
      if (process.platform === "darwin") {
        app.addListener("activate", () => MainWindowManager.checkAndShow("main"));
        mainWindow.addListener("close", (event) => {
          if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
          }
        });
      }

      mainWindow.addListener("closed", () => {
        this.exit(MainExitCodeConstants.NORMAL_EXIT, "");
      });
      app.addListener("window-all-closed", () => {
        this.exit(MainExitCodeConstants.NORMAL_EXIT, "");
      });
      app.addListener("before-quit", (e) => {
        e.preventDefault();
        if (process.platform === "darwin") {
          mainWindow.hide();
          isQuitting = true;
        }
        this.exit(MainExitCodeConstants.NORMAL_EXIT, "");
      });
      MainIPC.MessageChannel.listen("message_dispatch_should_close", (close) => {
        if (!close) return;
        if (process.platform === "darwin") {
          mainWindow.hide();
          isQuitting = true;
        }
        void this.emitStopMessageToMainRenderer();
      });

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
   * @desc 是否启用Agent \
   * error: log \
   * return: 是否启用成功
   * */
  private enableAgent() {
    try {
      return MainAgentFeatureSettings.isAgentRequestedAtStartup() && !!MainAgent.init();
    } catch (err) {
      Log.warn("agent", "failed to enable agent", err);
      return false;
    }
  }

  /** 按应用启动时的快照启动本地只读 MCP。 */
  private async enableMcp() {
    try {
      const endpoint = await MainMcp.init();
      MainAgent.broadcastFeatureSettings();
      if (endpoint) {
        const toolCount = MainAgentFeatureSettings.getState().effective.mcpTools.length;
        Log.info("mcp", `MCP listening at ${endpoint.url} with ${toolCount} tools`);
      }
      return Boolean(endpoint);
    } catch (err) {
      MainAgent.broadcastFeatureSettings();
      Log.warn("mcp", "failed to enable MCP", err);
      return false;
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

  private emitStopMessageToMainRenderer() {
    const { promise, resolve } = Promise.withResolvers<void>();

    Log.info("quit", "emit 'message_dispatch_should_close' message");
    MainIPC.MessageChannel.commit({
      sender: "process",
      receiver: "main",
      type: "message_dispatch_should_close",
      data: true
    });
    setTimeout(() => {
      Log.info("quit", "exiting after commit 'message_dispatch_should_close' message");
      resolve();
    }, 2000);

    return promise;
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

    // this.registerAppProtocol(); // 注册自定义应用协议
    // if (this.isExiting) return;
    // Log.info("App protocol registered");

    app
      .whenReady()
      .then(async () => {
        Log.info("App ready");
        MainAgentFeatureSettings.captureStartup();

        // 绑定 AppUserModelID
        if (process.platform === "win32") {
          app.setAppUserModelId(process.env.APP_USER_MODEL_ID);
          Log.info(`App user model id is ${process.env.APP_USER_MODEL_ID}`);
        }

        this.registerIPCHandlers(); // 注册IPC
        if (this.isExiting) return;
        Log.info("App ipc handlers registered");

        this.trustLocalProxyCertificate(); // 信任本地代理证书
        if (this.isExiting) return;
        Log.info("App local proxy certificate trusted");

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

        const enable = this.enableAgent(); // 启用 Agent
        if (this.isExiting) return;
        enable && Log.info("App agent initialized");

        const mcpEnabled = await this.enableMcp(); // 启用本地 MCP
        if (this.isExiting) return;
        mcpEnabled && Log.info("App MCP initialized");

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
   *
   * 退出流程：
   * ```text
   * 第一类（quit 流程）
   * before-quit 拦截 → 转入 MainApp.exit()
   * 第二类（app.exit）
   * 只有 MainApp.exit() 使用，其他意外的 process.exit 由 process.on("exit") 补充信号
   * 第三类（强杀/崩溃）
   * 无解，靠子进程的 stdin 管道 EOF 自检来进行非JS部分的清理
   * 第四类（主窗口关闭）
   * window、linux上主窗口可以关闭，且直接调用 exit 退出，mac上不会关闭，靠第一类退出流程
   * ```
   * */
  exit(code: number, reason: string) {
    if (this._status === "exiting") return;
    this._status = "exiting";
    MainAgent.shutdown();
    const stopMcp = MainMcp.shutdown();

    // 异常退出输出错误日志
    if (code !== MainExitCodeConstants.NORMAL_EXIT) {
      Log.error("app exit", reason);
    }

    this.emitStopMessageToMainRenderer()
      .catch((error) => Log.warn("app exit", "failed to notify renderer", error))
      .then(() => Promise.allSettled([this.stopAllServers(), stopMcp]))
      .finally(() => {
        app.exit(code);
      });
  }
}
