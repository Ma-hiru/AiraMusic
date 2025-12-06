import { APP } from "./index";
import { app, dialog, Event } from "electron";
import { Log } from "../utils/log";
import { isCreateTray, isLinux, isMacOS } from "../utils/platform";
import { registerIpcMainHandlers, typedIpcMainSend } from "../ipc";
import { stopCacheServer } from "../services/store";
import { CreateMainWindow } from "../window";
import { Store } from "./store";
import { EqError } from "../utils/err";

export function handleAppEvents(instance: APP) {
  app.on("ready", async () => {
    Log.debug("App ready");
    instance.window = CreateMainWindow();
    handleWindowEvents(instance);
    registerIpcMainHandlers(instance.window);
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
      instance.window = CreateMainWindow();
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

function handleWindowEvents(instance: APP) {
  instance.window.once("ready-to-show", () => {
    Log.debug("Window ready-to-show");
    // 等待react的load事件再显示窗口
    // instance.window.show();
    // 把窗口位置尺寸保存（用于下次启动恢复）
    Store.set("window", instance.window.getBounds());
  });

  instance.window.on("close", (e) => {
    Log.debug("Window closed");
    if (isLinux) {
      closeOnLinux(e, instance);
    } else if (isMacOS) {
      // 一般惯例是点击左上红点不退出应用，而是隐藏窗口（除非用户真正退出）
      // this.willQuitApp 标志用来区别用户是否在真正退出（例如 app.quit()）
      if (instance.willQuitAPP) {
        // @ts-expect-error
        instance.window = null;
        app.quit();
      } else {
        e.preventDefault();
        instance.window.hide();
      }
    } else {
      const closeOpts = Store.get("settings.closeAppOption");
      if (instance.willQuitAPP && (closeOpts === "exit" || closeOpts === "ask")) {
        //@ts-expect-error
        instance.window = null;
        app.quit();
      } else {
        e.preventDefault();
        instance.window.hide();
      }
    }
  });

  instance.window.on("resized", () => {
    Store.set("window", instance.window.getBounds());
  });

  instance.window.on("moved", () => {
    Store.set("window", instance.window.getBounds());
  });

  instance.window.on("maximize", () => {});

  instance.window.on("unmaximize", () => {});

  instance.window.webContents.setWindowOpenHandler((e) => {
    Log.info(`Blocked attempt to open external link: ${e.url}`);
    // TODO: 可以考虑用 shell.openExternal 打开外部浏览器
    return { action: "deny" };
  });
}

function closeOnLinux(e: Event, instance: APP) {
  const closeOpts = Store.get("settings.closeAppOption");
  if (closeOpts !== "exit") {
    e.preventDefault();
  }
  if (closeOpts === "ask") {
    dialog
      .showMessageBox({
        type: "info",
        title: "Information",
        cancelId: 2,
        defaultId: 0,
        message: "确定关闭吗？",
        buttons: ["最小化到托盘", "退出应用"],
        checkboxLabel: "记住我的选择"
      })
      .then((result) => {
        if (result.checkboxChecked && result.response !== 2) {
          typedIpcMainSend(
            instance.window,
            "rememberCloseAppOption",
            result.response === 0 ? "minimizeToTray" : "exit"
          );
        }
        if (result.response === 0) {
          instance.window.hide();
        } else if (result.response === 1) {
          // @ts-expect-error
          instance.window = null;
          //exit()直接关闭客户端，不会执行quit();
          app.exit();
        }
      })
      .catch((err) => {
        Log.error(
          new EqError({
            raw: err,
            label: "app/windowEvent.ts",
            message: "Error showing close confirmation dialog"
          })
        );
      });
  }
}
