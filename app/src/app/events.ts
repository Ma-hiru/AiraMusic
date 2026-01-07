import { APP } from "./index";
import { app } from "electron";
import { Log } from "../utils/log";
import { isCreateTray, isLinux, isMacOS } from "../utils/platform";
import { stopStoreServer } from "../services/store";
import { CreateMainWindow, WindowManager } from "../window";
import { typedIpcMainSendMessage } from "../ipc/main/typed";

export function registerAppEvents(instance: APP) {
  app.on("ready", async () => {
    Log.debug("App ready");
    CreateMainWindow();
    handleExternalWindowEvents(instance);
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
    CreateMainWindow(); // 内部会检查是否已存在窗口
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
    instance.proxyServer.close();
    stopStoreServer();
  });

  // 退出前注销全局快捷键
  app.on("will-quit", async () => {
    Log.debug("App will-quit");
    typedIpcMainSendMessage({
      sender: "main",
      receiver: "main",
      type: "mainProcessExit",
      data: undefined
    });
    await instance.neteaseMusicAPIServer
      .then((ncm) => {
        Log.debug("stop neteaseMusicAPIServer");
        ncm?.server?.close();
      })
      .catch((err) => {
        Log.debug(`failed to stop neteaseMusicAPIServer: ${err}`);
      });
  });

  if (!isMacOS) {
    // 当用户再次尝试打开应用（双击可执行文件）时，主实例接收事件；常见做法是把原窗口 show()/focus()。注意在 requestSingleInstanceLock() 返回 true 的情况下，这个事件会被触发
    app.on("second-instance", () => {
      WindowManager.checkAndShow("main");
    });
  }
}

function handleExternalWindowEvents(instance: APP) {
  const mainWindow = WindowManager.get("main");
  if (!mainWindow) return;
  mainWindow.on("close", (e) => {
    Log.debug("Window closed");
    if (isLinux) {
      /* empty */
    } else if (isMacOS) {
      // 一般惯例是点击左上红点不退出应用，而是隐藏窗口（除非用户真正退出）
      // this.willQuitApp 标志用来区别用户是否在真正退出（例如 app.quit()）
      if (instance.willQuitAPP) {
        app.quit();
      } else {
        e.preventDefault();
        mainWindow.hide();
      }
    } else {
      // TODO
      if (instance.willQuitAPP) {
        app.quit();
      } else {
        e.preventDefault();
        mainWindow.hide();
      }
    }
  });
}
