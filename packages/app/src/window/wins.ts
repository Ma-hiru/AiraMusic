import { AppWindowCreatorProps, AppWindowManager, WindowExits } from "./manager";
import { preloadPath } from "../utils/path";
import { BrowserWindow, dialog } from "electron";
import { isLinux } from "../utils/platform";
import { AppWindowConstants } from "../constants/win";
import { isDev } from "../utils/dev";
import { Log } from "../utils/log";
import AppScreen from "../utils/screen";

export class AppWindows {
  static fatalError(message: string, error?: string) {
    // TODO
    Log.error({ label: "App fatalError", message, raw: error });
    dialog.showErrorBox("应用发生致命错误", `${message}\n ${error || ""}`);
    AppWindowManager.get("main")?.close();
  }

  static get login(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.login
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        title: process.env.APP_NAME + " - 登录",
        resizable: false,
        minimizable: true,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false
      },
      id: "login",
      handleExits: WindowExits.DESTROY,
      memoPos: false,
      loadURL: (port: number) => `http://localhost:${port}/login.html`
    };
  }

  static get image(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.image
    );

    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        title: process.env.APP_NAME,
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false,
        show: false,
        center: true
      },
      id: "image",
      handleExits: WindowExits.IGNORE,
      memoPos: false,
      loadURL: (port: number) => `http://localhost:${port}/image.html`
    };
  }

  static get lyric(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.lyric
    );

    return {
      options: {
        width,
        height,
        transparent: true,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: true,
        minimizable: false,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false
      },
      id: "lyric",
      handleExits: WindowExits.DESTROY,
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/lyric.html`,
      onCreate: (win: BrowserWindow) => {
        isLinux && win.setAlwaysOnTop(true, "screen-saver");
      }
    };
  }

  static get miniplayer(): AppWindowCreatorProps {
    const { min, max, base } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.miniplayer
    );
    return {
      options: {
        width: base.width,
        height: base.height,
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: true,
        minHeight: min.height,
        maxHeight: max.height,
        minWidth: min.width,
        maxWidth: max.width,
        minimizable: false,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false
      },
      id: "miniplayer",
      handleExits: WindowExits.IGNORE,
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/mini.html`,
      onCreate: (win: BrowserWindow) => {
        isLinux && win.setAlwaysOnTop(true, "screen-saver");
        win.hide();
      }
    };
  }

  static get main(): AppWindowCreatorProps {
    const { min, base } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.main
    );

    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        title: AppWindowConstants.MAIN_WINDOW_TITLE,
        titleBarStyle: "hidden",
        webPreferences: {
          webgl: true,
          preload: preloadPath,
          backgroundThrottling: false,
          webSecurity: false
        },
        frame: false,
        show: false
      },
      memoPos: true,
      id: "main",
      handleExits: WindowExits.IGNORE,
      loadURL: (port: number) => `http://localhost:${port}`,
      onCreate: (win: BrowserWindow) => {
        win.setMenuBarVisibility(false);
        isDev && win.webContents.openDevTools();
      }
    };
  }

  static get trayOnWindows(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.trayOnWindows
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: false,
        minimizable: false,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false
      },
      id: "tray",
      handleExits: WindowExits.IGNORE,
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/tray.html`
    };
  }

  static get info(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.info
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        title: "info",
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false
      },
      memoPos: true,
      id: "info",
      handleExits: WindowExits.IGNORE,
      loadURL: (port: number) => `http://localhost:${port}/info.html`,
      onCreate: (win: BrowserWindow) => {
        isDev && win.webContents.openDevTools();
      }
    };
  }

  static get comments(): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.comments
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: preloadPath
        },
        title: "comments",
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false
      },
      memoPos: true,
      id: "comments",
      handleExits: WindowExits.IGNORE,
      loadURL: (port: number) => `http://localhost:${port}/comments.html`,
      onCreate: (win: BrowserWindow) => {
        isDev && win.webContents.openDevTools();
      }
    };
  }

  static external(title: string, url: string): AppWindowCreatorProps {
    const { width, height } = AppScreen.primary.adaptiveWindowSizePreset(
      AppWindowConstants.WINDOW_BASE_SIZE.external
    );

    return {
      options: {
        width,
        height,
        title: title || process.env.APP_NAME,
        resizable: true,
        minimizable: true,
        maximizable: true,
        frame: true
      },
      id: "external",
      handleExits: WindowExits.DESTROY,
      memoPos: true,
      loadURL: () => url
    };
  }

  static get(type: WindowType) {
    if (type === "all" || type === "tray" || type === "external" || type === "process") {
      return null;
    }
    return this[type];
  }
}
