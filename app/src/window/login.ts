import { WindowExits, WindowManager } from "./manager";
import { getEffectiveWindowSize } from "../utils/screen";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import { EqError } from "../utils/err";
import { BrowserWindow } from "electron";
import { CONSTANTS } from "@mahiru/app/src/constant";

export function CreateLoginWindow() {
  if (WindowManager.checkAndShow("login")) return;

  const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.3);
  const LoginWindow = WindowManager.createBrowserWindow(
    {
      width,
      height,
      webPreferences: {
        preload: preloadPath
      },
      title: "Login",
      resizable: false,
      minimizable: true,
      maximizable: false,
      titleBarStyle: "hidden",
      frame: false,
      type: "toolbar",
      skipTaskbar: true,
      show: false
    },
    "login",
    WindowExits.DESTROY
  );

  LoginWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  LoginWindow.center();

  loadLoginWindowURL(
    LoginWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );
}

function loadLoginWindowURL(LoginWindow: BrowserWindow, port: string | number) {
  LoginWindow.loadURL(`http://localhost:${port}/login.html`).catch((err) => {
    Log.error(
      new EqError({
        raw: err,
        message: `failed to load login window URL: http://localhost:${port}/login`,
        label: "app/window/login.ts"
      })
    );
  });
  setTimeout(() => {
    if (!WindowManager.get("login")?.isVisible()) {
      // 超时仍未显示窗口，说明加载失败
      Log.error(
        new EqError({
          label: "app/window/login.ts",
          message: `login window failed to load within expected time`
        })
      );
      WindowManager.get("login")?.close();
    }
  }, CONSTANTS.APP.WINDOW_LOAD_TIMEOUT);
}
