import ElectronStore from "electron-store";
import { BrowserWindow } from "electron";
import { typedIpcMainOn, typedIpcMainSend } from "./typed";
import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../../utils/screen";
import { WindowExits, WindowManager } from "../../window";
import { preloadPath } from "../../utils/path";
import { Log } from "../../utils/log";
import { isDev } from "../../utils/dev";
import { Store, StoreType } from "../../app/store";

export function registerEventHandlers(mainWindow: BrowserWindow, store: ElectronStore<StoreType>) {
  registerLoginWindowControl();
  registerLyricWindowControl();
  registerMiniplayerWindowControl();
  registerWindowControl(mainWindow);
}

function registerLoginWindowControl() {
  typedIpcMainOn("createLoginWindow", () => {
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
        skipTaskbar: true
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
        // isDev() && LoginWindow.webContents.openDevTools();
      });
    }
  });
}

function registerLyricWindowControl() {
  typedIpcMainOn("createLyricWindow", () => {
    const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.15, 5.9);
    const LyricWindow = WindowManager.createBrowserWindow(
      {
        width,
        height,
        transparent: true,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: "Lyric",
        resizable: true,
        minimizable: false,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true
      },
      "lyric",
      WindowExits.IGNORE
    );
    const { x, y } = Store.get("lyric");
    if (checkPositionOutScreenBounds(x, y)) {
      LyricWindow.center();
    } else {
      LyricWindow.setBounds({ x, y });
    }
    LyricWindow.on("resized", () => {
      Store.set("lyric", LyricWindow.getBounds());
    });
    LyricWindow.on("move", () => {
      Store.set("lyric", LyricWindow.getBounds());
    });
    if (isDev()) {
      LyricWindow.loadURL("http://localhost:5173/lyric").catch((err) => {
        Log.error("app/ipc", "Failed to load lyric window URL:", err);
      });
    } else {
      LyricWindow.loadURL("http://localhost:27232/lyric").catch((err) => {
        Log.error("app/ipc", "Failed to load lyric window URL:", err);
      });
    }
    LyricWindow.on("ready-to-show", () => {
      LyricWindow.show();
    });
  });
}

function registerMiniplayerWindowControl() {
  typedIpcMainOn("createMiniplayerWindow", () => {
    const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.08, 4.45);
    const MiniplayerWindow = WindowManager.createBrowserWindow(
      {
        width,
        height,
        transparent: true,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: "miniplayer",
        resizable: true,
        maxHeight: height,
        minimizable: false,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true
      },
      "miniplayer",
      WindowExits.IGNORE
    );
    const { x, y } = Store.get("mini");
    if (checkPositionOutScreenBounds(x, y)) {
      MiniplayerWindow.center();
    } else {
      MiniplayerWindow.setBounds({ x, y });
    }
    MiniplayerWindow.on("resized", () => {
      Store.set("mini", MiniplayerWindow.getBounds());
    });
    MiniplayerWindow.on("move", () => {
      Store.set("mini", MiniplayerWindow.getBounds());
    });
    if (isDev()) {
      MiniplayerWindow.loadURL("http://localhost:5173/mini").catch((err) => {
        Log.error("app/ipc", "Failed to load mini window URL:", err);
      });
    } else {
      MiniplayerWindow.loadURL("http://localhost:27232/mini").catch((err) => {
        Log.error("app/ipc", "Failed to load mini window URL:", err);
      });
    }
    MiniplayerWindow.on("ready-to-show", () => {
      MiniplayerWindow.show();
    });
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
  typedIpcMainOn("hidden", (_e, type) => {
    Log.trace("app/ipc", "IPC Hidden Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && win.isVisible()) {
      win.hide();
    }
  });
  typedIpcMainOn("visible", (_e, type) => {
    Log.trace("app/ipc", "IPC Visible Window:", type);
    const win = WindowManager.getBrowserWindowById(type);
    if (win && !win.isVisible()) {
      win.show();
    }
  });
  typedIpcMainOn("sendMessageTo", (_e, { to, data, type, from }) => {
    const win = WindowManager.getBrowserWindowById(to);
    if (win) {
      typedIpcMainSend(win, "sendMessageTo", { to, data, type, from });
    }
  });
}
