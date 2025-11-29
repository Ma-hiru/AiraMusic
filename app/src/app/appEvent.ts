import { APP } from "./index";
import { app } from "electron";
import { Log } from "../utils/log";
import { createInitWindow } from "./createWindow";
import { handleWindowEvents } from "./windowEvent";
import { isCreateTray, isMacOS } from "../utils/platform";
import { registerIpcMainHandlers } from "../ipc";
import { stopCacheServer } from "@mahiru/app/src/services/store";

export function handleAppEvents(instance: APP) {
  app.on("ready", async () => {
    Log.debug("App ready");
    instance.window = createInitWindow(instance.store.get("window"));
    handleWindowEvents(instance);
    registerIpcMainHandlers(instance.window, instance.store);
    if (isCreateTray) {
      // TODO
    }
    // TODO proxy
    // TODO menu
    // TODO dock
    // TODO touch
    // TODO ......
  });

  // macOS 行为，点击 Dock 图标时如果没有窗口则重建
  app.on("activate", () => {
    Log.debug("App activated");
    if (instance.window === null) {
      instance.window = createInitWindow(instance.store.get("window"));
    } else {
      instance.window.show();
    }
  });

  // macOS 里 window-all-closed 不自动退出程序（保持 Dock 图标），在非 macOS 平台通常退出。
  app.on("window-all-closed", () => {
    Log.debug("App window all-closed");
    !isMacOS && app.quit();
  });

  // 应用即将退出，this.willQuitApp = true; 用于 window.close 事件里的逻辑判断（确定用户是不是要退出）。
  app.on("before-quit", () => {
    Log.debug("App before-quit");
    instance.willQuitAPP = true;
  });

  // 在退出时清理资源，例如 this.expressApp.close() 停掉本地 HTTP 服务。
  app.on("quit", () => {
    Log.debug("App quit");
    instance.expressAPP.close();
    stopCacheServer();
    instance.neteaseMusicAPIServer
      .then((ncm) => {
        Log.debug("stop neteaseMusicAPIServer");
        ncm?.server?.close();
      })
      .catch((err) => {
        Log.debug(`failed to stop neteaseMusicAPIServer: ${err}`);
      });
  });

  // 退出前注销全局快捷键
  app.on("will-quit", () => {
    Log.debug("App will-quit");
    // TODO
  });

  if (!isMacOS) {
    // 当用户再次尝试打开应用（双击可执行文件）时，主实例接收事件；常见做法是把原窗口 show()/focus()。注意在 requestSingleInstanceLock() 返回 true 的情况下，这个事件会被触发
    app.on("second-instance", () => {
      if (instance.window) {
        instance.window.show();
        if (instance.window.isMinimized()) {
          instance.window.restore();
        }
        instance.window.focus();
      }
    });
  }
}
