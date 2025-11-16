import { BrowserWindow } from "electron";
import ElectronStore from "electron-store";
import { StoreType } from "../../background";
import { typedIpcMainOn, typedIpcMainSend } from "./typed";
import { calcEffectivePixel } from "../../utils/screen";
import { WindowExits, WindowManager } from "../../window";
import { preloadPath } from "../../utils/path";
import { Log } from "../../utils/log";
import { CONSTANTS } from "../../constant";
import { isDev } from "../../utils/dev";

export function registerEventHandlers(mainWindow: BrowserWindow, store: ElectronStore<StoreType>) {
  registerLoginWindowControl();
  registerWindowControl(mainWindow);
}

function registerLoginWindowControl() {
  typedIpcMainOn("createLoginWindow", (_e) => {
    const ratio = CONSTANTS.APP.DEFAULT_WINDOW_WIDTH_HEIGHT_RATIO;
    const height = calcEffectivePixel(650 + 50);
    const width = calcEffectivePixel(650 * ratio);
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
        frame: false
      },
      "login",
      WindowExits.IGNORE
    );
    if (LoginWindow.isMinimized()) {
      LoginWindow.restore();
      LoginWindow.focus();
    } else {
      if (isDev()) {
        LoginWindow.loadURL("http://localhost:5173/login").catch((err) => {
          Log.error("app/ipc", "Failed to load login window URL:", err);
        });
      } else {
        LoginWindow.loadURL("http://localhost:27232/login").catch((err) => {
          Log.error("app/ipc", "Failed to load login window URL:", err);
        });
      }
      LoginWindow.on("ready-to-show", () => {
        LoginWindow.show();
        LoginWindow.webContents.openDevTools();
      });
    }
  });
}

function registerWindowControl(mainWindow: BrowserWindow) {
  typedIpcMainOn("close", (_e, type) => {
    Log.trace("app/ipc", "IPC Close Window:", type);
    WindowManager.getBrowserWindowById(type)?.close();
  });
  typedIpcMainOn("minimize", (_e, type) => {
    Log.trace("app/ipc", "IPC Minimize Window:", type);
    WindowManager.getBrowserWindowById(type)?.minimize();
  });
  typedIpcMainOn("maximize", (_e, type) => {
    Log.trace("app/ipc", "IPC Maximize Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && !win.isMaximized()) {
      win.maximize();
    }
  });
  typedIpcMainOn("unmaximize", (_e, type) => {
    Log.trace("app/ipc", "IPC Unmaximize Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && win.isMaximized()) {
      win.unmaximize();
    }
  });
  typedIpcMainOn("loggedInSuccess", (_e, data) => {
    Log.trace("app/ipc", "IPC Logged In Success:", data);
    typedIpcMainSend(mainWindow, "loggedInSuccess", data);
  });
}
