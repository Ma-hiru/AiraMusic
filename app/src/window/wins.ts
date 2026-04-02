import { AppWindowCreatorProps, WindowExits } from "./manager";
import { preloadPath } from "../utils/path";
import { BrowserWindow } from "electron";
import { isLinux } from "../utils/platform";
import { AppWindowConstants } from "../constant/win";
import { isDev } from "../utils/dev";
import AppScreen from "../utils/screen";

export class AppWindows {
  private static clampSizeByArea(
    baseWidth: number,
    baseHeight: number,
    maxWidth: number,
    maxHeight: number
  ) {
    const safeBaseWidth = Math.max(1, Math.floor(baseWidth));
    const safeBaseHeight = Math.max(1, Math.floor(baseHeight));
    const safeMaxWidth = Math.max(1, Math.floor(maxWidth));
    const safeMaxHeight = Math.max(1, Math.floor(maxHeight));
    const scale = Math.min(1, safeMaxWidth / safeBaseWidth, safeMaxHeight / safeBaseHeight);

    return {
      width: Math.max(1, Math.floor(safeBaseWidth * scale)),
      height: Math.max(1, Math.floor(safeBaseHeight * scale))
    };
  }

  static get login(): AppWindowCreatorProps {
    const { width: baseWidth, height: baseHeight } = AppWindowConstants.WINDOW_BASE_SIZE.login;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.3,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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
    const { width: baseWidth, height: baseHeight } = AppWindowConstants.WINDOW_BASE_SIZE.image;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.5,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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
    const { width: baseWidth, height: baseHeight } = AppWindowConstants.WINDOW_BASE_SIZE.lyric;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.11,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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
    const { width: baseWidth, height: baseHeight } =
      AppWindowConstants.WINDOW_BASE_SIZE.miniplayer.default;
    const { width: minBaseWidth, height: minBaseHeight } =
      AppWindowConstants.WINDOW_BASE_SIZE.miniplayer.min;
    const { width: maxBaseWidth, height: maxBaseHeight } =
      AppWindowConstants.WINDOW_BASE_SIZE.miniplayer.max;
    const { width: areaMaxWidth, height: areaMaxHeight } = AppScreen.primary.getAreaBounds(
      0.07,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(
      baseWidth,
      baseHeight,
      areaMaxWidth,
      areaMaxHeight
    );
    const { width: areaMinWidth, height: areaMinHeight } = AppScreen.primary.getAreaBounds(
      0.05,
      baseWidth / baseHeight
    );
    const minSize = this.clampSizeByArea(minBaseWidth, minBaseHeight, areaMinWidth, areaMinHeight);
    const minWidth = Math.min(minSize.width, width);
    const minHeight = Math.min(minSize.height, height);
    const { width: areaResizeMaxWidth, height: areaResizeMaxHeight } =
      AppScreen.primary.getAreaBounds(0.09, baseWidth / baseHeight);
    const maxSize = this.clampSizeByArea(
      maxBaseWidth,
      maxBaseHeight,
      areaResizeMaxWidth,
      areaResizeMaxHeight
    );
    const maxWidth = Math.max(maxSize.width, width);
    const maxHeight = Math.max(maxSize.height, height);

    return {
      options: {
        width,
        height,
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
    const BASE_WIDTH = AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxWidth;
    const BASE_HEIGHT = AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxHeight;

    const { width: areaMaxWidth, height: areaMaxHeight } = AppScreen.primary.getAreaBounds(
      AppWindowConstants.DEFAULT_WINDOW_COVER_RATIO,
      BASE_WIDTH / BASE_HEIGHT
    );
    const { width: areaMinWidth, height: areaMinHeight } = AppScreen.primary.getAreaBounds(
      0.6,
      BASE_WIDTH / BASE_HEIGHT
    );
    const { width, height } = this.clampSizeByArea(
      BASE_WIDTH,
      BASE_HEIGHT,
      areaMaxWidth,
      areaMaxHeight
    );

    const minWidth = Math.min(
      Math.min(areaMinWidth, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.minWidth),
      width
    );
    const minHeight = Math.min(
      Math.min(areaMinHeight, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.minHeight),
      height
    );
    const maxWidth = Math.max(
      width,
      Math.min(areaMaxWidth, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxWidth)
    );
    const maxHeight = Math.max(
      height,
      Math.min(areaMaxHeight, AppWindowConstants.DEFAULT_MAIN_WINDOW_BOUNDS.maxHeight)
    );

    return {
      options: {
        width,
        height,
        minHeight,
        minWidth,
        maxWidth,
        maxHeight,
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
    const { width: baseWidth, height: baseHeight } =
      AppWindowConstants.WINDOW_BASE_SIZE.trayOnWindows;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.4,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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
    const { width: baseWidth, height: baseHeight } = AppWindowConstants.WINDOW_BASE_SIZE.info;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.5,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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

  static external(title: string, url: string): AppWindowCreatorProps {
    const { width: baseWidth, height: baseHeight } = AppWindowConstants.WINDOW_BASE_SIZE.external;
    const { width: maxWidth, height: maxHeight } = AppScreen.primary.getAreaBounds(
      0.5,
      baseWidth / baseHeight
    );
    const { width, height } = this.clampSizeByArea(baseWidth, baseHeight, maxWidth, maxHeight);

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
