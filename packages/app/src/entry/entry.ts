import { app } from "electron";
import { MainApp } from "./app";
import { MainExitCodeConstants } from "@/constants/exit-code";

/**
 * @desc 程序的入口 \
 * 位于所有服务、IPC之前，用于处理 commands 和多实例，确认之后才会进入（执行）程序实例
 * */
export class MainEntry {
  instance: MainApp;

  constructor(instance: MainApp) {
    this.instance = instance;
  }

  private commands() {
    app.enableSandbox();
    process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
  }

  tryRun() {
    this.commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      this.instance.init();
    } else {
      // 多实例，正常退出
      app.exit(MainExitCodeConstants.MULTI_INSTANCE);
    }
  }
}
