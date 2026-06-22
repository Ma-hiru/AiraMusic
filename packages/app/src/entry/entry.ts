import { app, session } from "electron";
import { MainApp } from "./app";
import { MainExitCodeConstants } from "@/constants/exit-code";
import { MainHandle } from "@/lib/handle";

/**
 * @desc 程序的入口 \
 * 位于所有服务、IPC之前，用于处理 commands 和多实例，确认之后才会进入（执行）程序实例
 * */
export class MainEntry {
  instance: MainApp;

  constructor(instance: MainApp) {
    this.instance = instance;
  }

  private permissions(permissions: string[]) {
    const allowPermissions = new Set(permissions);
    app.whenReady().then(() => {
      session.defaultSession.setPermissionRequestHandler(
        (webContents, permission, callback, details) => {
          const url = details.requestingUrl || webContents.getURL();
          if (!MainHandle.isTrustedOrigin(url)) return callback(false);
          callback(allowPermissions.has(permission));
        }
      );
      session.defaultSession.setPermissionCheckHandler(
        (_, permission, requestingOrigin, details) => {
          const url = details.requestingUrl || requestingOrigin;
          if (!MainHandle.isTrustedOrigin(url)) return false;
          return allowPermissions.has(permission);
        }
      );
    });
  }

  private commands(commands: [the_switch: string, value?: string][]) {
    app.enableSandbox();
    process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";
    for (const [the_switch, value] of commands) {
      app.commandLine.appendSwitch(the_switch, value);
    }
  }

  tryRun() {
    this.commands([]);
    this.permissions(["speaker-selection", "clipboard-sanitized-write"]);
    // 单实例锁，避免多开
    if (app.requestSingleInstanceLock()) {
      this.instance.init();
    } else {
      // 多实例，正常退出
      app.exit(MainExitCodeConstants.MULTI_INSTANCE);
    }
  }
}
