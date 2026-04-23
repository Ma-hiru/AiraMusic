import { app } from "electron";
import { APP } from "./app";

export default class Entry {
  private static instance: Nullable<APP> = null;

  private static commands() {
    app.enableSandbox();
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = "true";
  }

  static create() {
    if (this.instance) return this.instance;
    return (this.instance = new APP());
  }

  static run(instance: APP) {
    this.commands();
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      instance.init();
    } else {
      app.exit(0); // 正常退出
    }
  }
}
