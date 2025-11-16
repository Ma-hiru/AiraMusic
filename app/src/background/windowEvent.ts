import { APP } from "./index";
import { Log } from "../utils/log";
import { isLinux, isMacOS } from "../utils/platform";
import { Event, dialog, app } from "electron";
import { typedIpcMainSend } from "../ipc";
import { EqError } from "../utils/err";

export function handleWindowEvents(instance: APP) {
  instance.window.once("ready-to-show", () => {
    Log.trace("Window ready-to-show");
    instance.window.show();
    // 把窗口位置尺寸保存（用于下次启动恢复）
    instance.store.set("window", instance.window.getBounds());
  });

  instance.window.on("close", (e) => {
    Log.trace("Window closed");
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
      const closeOpts = instance.store.get("settings.closeAppOption");
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
    instance.store.set("window", instance.window.getBounds());
  });

  instance.window.on("moved", () => {
    instance.store.set("window", instance.window.getBounds());
  });

  instance.window.on("maximize", () => {
    typedIpcMainSend(instance.window, "isMaximized", true);
  });

  instance.window.on("unmaximize", () => {
    typedIpcMainSend(instance.window, "isMaximized", false);
  });

  instance.window.webContents.setWindowOpenHandler((e) => {
    Log.info(`Blocked attempt to open external link: ${e.url}`);
    // TODO: 可以考虑用 shell.openExternal 打开外部浏览器
    return { action: "deny" };
  });
}

function closeOnLinux(e: Event, instance: APP) {
  const closeOpts = instance.store.get("settings.closeAppOption");
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
