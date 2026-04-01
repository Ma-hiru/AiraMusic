import { getEffectiveWindowSize } from "../utils/screen";
import { AppWindowCreatorProps, WindowExits } from "./manager";
import { preloadPath } from "../utils/path";
import { BrowserWindow } from "electron";
import { isLinux } from "../utils/platform";
import { AppWindowConstants } from "../constant/win";
import { isDev } from "../utils/dev";

export class AppWindows {
  static get login(): AppWindowCreatorProps {
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.3);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
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
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.5);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
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
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.11, 6);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
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
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.07, 4.4);
    const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(
      0.05,
      4.4
    );
    const maxHeight = Math.floor(effectiveHeight * 1.2);
    const maxWidth = Math.floor(effectiveWidth * 1.2);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
        webPreferences: {
          preload: preloadPath
        },
        alwaysOnTop: true,
        title: process.env.APP_NAME,
        resizable: true,
        minHeight,
        maxHeight,
        minWidth,
        maxWidth,
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
      }
    };
  }

  static get main(): AppWindowCreatorProps {
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize();
    const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(0.6);

    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
        minHeight: Math.min(minHeight, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.minHeight),
        minWidth: Math.min(minWidth, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.minWidth),
        maxWidth: AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxWidth,
        maxHeight: AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxHeight,
        title: AppWindowConstants.MAIN_WINDOW_TITLE,
        titleBarStyle: "hidden",
        webPreferences: {
          preload: preloadPath,
          experimentalFeatures: true,
          webgl: true,
          webSecurity: false,
          backgroundThrottling: false
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
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.4, 0.4);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
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
    const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize(0.5);
    return {
      options: {
        width: effectiveWidth,
        height: effectiveHeight,
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

  static external(title: string, url: string): AppWindowCreatorProps {
    const { effectiveWidth: width, effectiveHeight: height } = getEffectiveWindowSize(0.5);
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
}
