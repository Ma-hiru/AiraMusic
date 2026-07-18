import { dialog, BrowserWindow } from "electron";
import { Log } from "@/lib/log";
import { getArgFlag } from "@/utils/args";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import { MainWindowConstants } from "@/constants/window";
import { MainWindowManager } from "@/lib/window-manager";
import { MainScreenResolver } from "@/lib/screen-resolver";
import type { AppWindowCreatorProps } from "@/types/window";

export class MainWindowPreset {
  static fatalError(message: string, error?: string) {
    Log.error({ label: "App fatalError", message, raw: error });
    dialog.showErrorBox("应用发生致命错误", `${message}\n ${error || ""}`);
    MainWindowManager.get("main")?.close();
  }

  static get login(): AppWindowCreatorProps {
    const {
      base: { width, height }
    } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.login
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        title: process.env.APP_NAME + " - 登录",
        resizable: false,
        minimizable: true,
        maximizable: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false,
        icon: MainPathResolver.appLogoPath,
        alwaysOnTop: true
      },
      id: "login",
      handleExits: "DESTROY",
      memoPos: false,
      loadURL: (port: number) => `http://localhost:${port}/login.html`
    };
  }

  static get image(): AppWindowCreatorProps {
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.image
    );

    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        title: process.env.APP_NAME,
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false,
        show: false,
        center: true,
        icon: MainPathResolver.appLogoPath
      },
      id: "image",
      handleExits: "IGNORE",
      memoPos: false,
      loadURL: (port: number) => `http://localhost:${port}/image.html`
    };
  }

  static get lyric(): AppWindowCreatorProps {
    const { max, min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.lyric
    );

    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        maxHeight: max.height,
        minWidth: min.width,
        maxWidth: max.width,
        transparent: true,
        backgroundColor: "#00000000",
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: true,
        minimizable: false,
        maximizable: false,
        fullscreen: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false,
        hasShadow: false,
        icon: MainPathResolver.appLogoPath
      },
      id: "lyric",
      handleExits: "DESTROY",
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/lyric.html`,
      onCreate: (win: BrowserWindow) => {
        if (process.platform === "linux") {
          win.setAlwaysOnTop(true);
        } else {
          win.setAlwaysOnTop(true, "floating");
        }
      }
    };
  }

  static get miniplayer(): AppWindowCreatorProps {
    const { max, min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.miniplayer
    );
    return {
      options: {
        width: base.width,
        height: base.height,
        webPreferences: {
          preload: MainPathResolver.preloadPath
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
        fullscreen: false,
        titleBarStyle: "hidden",
        frame: false,
        type: "toolbar",
        skipTaskbar: true,
        show: false,
        icon: MainPathResolver.appLogoPath
      },
      id: "miniplayer",
      handleExits: "IGNORE",
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/mini.html`,
      onCreate: (win: BrowserWindow) => {
        win.hide();
        if (process.platform === "linux") {
          win.setAlwaysOnTop(true);
        } else {
          win.setAlwaysOnTop(true, "floating");
        }
      }
    };
  }

  static get main(): AppWindowCreatorProps {
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.main
    );

    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        title: MainWindowConstants.MAIN_WINDOW_TITLE,
        titleBarStyle: "hidden",
        webPreferences: {
          webgl: true,
          preload: MainPathResolver.preloadPath,
          backgroundThrottling: false,
          webSecurity: false
        },
        frame: false,
        show: false,
        icon: MainPathResolver.appLogoPath
      },
      memoPos: true,
      id: "main",
      handleExits: "IGNORE",
      loadURL: (port: number) => `http://localhost:${port}`,
      onCreate: (win: BrowserWindow) => {
        win.setMenuBarVisibility(false);
        (MainRuntime.isDev || getArgFlag("devtools")) && win.webContents.openDevTools();
      }
    };
  }

  static get trayOnWindows(): AppWindowCreatorProps {
    const {
      base: { width, height }
    } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.trayOnWindows
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: MainPathResolver.preloadPath
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
        show: false,
        transparent: true,
        backgroundColor: "#00000000",
        hasShadow: false,
        icon: MainPathResolver.appLogoPath
      },
      id: "tray",
      handleExits: "IGNORE",
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/tray.html`
    };
  }

  static get trayOnDarwin(): AppWindowCreatorProps {
    const {
      base: { width, height }
    } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.trayOnDarwin
    );
    return {
      options: {
        width,
        height,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: false,
        minimizable: false,
        maximizable: false,
        // 不设 titleBarStyle，避免 frameless 下仍显示红绿灯按钮
        frame: false,
        // NSPanel：非激活式面板，弹出时不会切走全屏 Space、不激活 Dock
        type: "panel",
        skipTaskbar: true,
        show: false,
        transparent: true,
        backgroundColor: "#00000000",
        hasShadow: false
      },
      id: "tray",
      handleExits: "IGNORE",
      memoPos: true,
      loadURL: (port: number) => `http://localhost:${port}/tray.html`,
      onCreate: (win: BrowserWindow) => {
        // 菜单栏弹窗需要盖在全屏应用之上
        win.setAlwaysOnTop(true, "pop-up-menu");
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      }
    };
  }

  static get display(): AppWindowCreatorProps {
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.display
    );
    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        title: "display",
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false,
        icon: MainPathResolver.appLogoPath
      },
      memoPos: true,
      id: "display",
      handleExits: "IGNORE",
      loadURL: (port: number) => `http://localhost:${port}/display.html`,
      onCreate: (win: BrowserWindow) => {
        (MainRuntime.isDev || getArgFlag("devtools")) && win.webContents.openDevTools();
      }
    };
  }

  static get comments(): AppWindowCreatorProps {
    const { max, min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.comments
    );
    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        maxHeight: max.height,
        minWidth: min.width,
        maxWidth: max.width,
        fullscreen: false,
        maximizable: false,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        title: "comments",
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false,
        icon: MainPathResolver.appLogoPath
      },
      memoPos: true,
      id: "comments",
      handleExits: "IGNORE",
      loadURL: (port: number) => `http://localhost:${port}/comments.html`,
      onCreate: (win: BrowserWindow) => {
        (MainRuntime.isDev || getArgFlag("devtools")) && win.webContents.openDevTools();
      }
    };
  }

  static get agent(): AppWindowCreatorProps {
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.agent
    );
    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        webPreferences: {
          preload: MainPathResolver.preloadPath
        },
        title: "agent",
        resizable: true,
        titleBarStyle: "hidden",
        frame: false,
        skipTaskbar: false,
        icon: MainPathResolver.appLogoPath
      },
      memoPos: true,
      id: "agent",
      handleExits: "IGNORE",
      loadURL: (port: number) => `http://localhost:${port}/agent.html`,
      onCreate: (win: BrowserWindow) => {
        (MainRuntime.isDev || getArgFlag("devtools")) && win.webContents.openDevTools();
      }
    };
  }

  static external(title: string, url: string): AppWindowCreatorProps {
    const { min, base } = MainScreenResolver.primary.adaptiveWindowSizePreset(
      MainWindowConstants.WINDOW_BASE_SIZE.external
    );

    return {
      options: {
        width: base.width,
        height: base.height,
        minHeight: min.height,
        minWidth: min.width,
        title: title || process.env.APP_NAME,
        resizable: true,
        minimizable: true,
        maximizable: true,
        frame: true,
        autoHideMenuBar: true,
        icon: MainPathResolver.appLogoPath
      },
      id: "external",
      handleExits: "DESTROY",
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
