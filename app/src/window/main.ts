import { BrowserWindow } from "electron";
import { Log } from "../utils/log";
import { Store } from "../app/store";
import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { CONSTANTS } from "../constant";
import { WindowManager } from "./manager";
import { preloadPath } from "../utils/path";
import { isDev } from "../utils/dev";
import { EqError } from "../utils/err";

export function CreateMainWindow() {
  if (WindowManager.checkAndShow("main")) return;

  Log.trace("Create APP Window");
  const params = Store.get("window");
  const { x, y } = params || {};
  const mainWindow = createWindow(params);
  // 检查窗口位置是否超出屏幕范围，超出则居中显示
  if (checkPositionOutScreenBounds(x, y)) {
    mainWindow.center();
  } else {
    mainWindow.setBounds({ x, y });
  }

  // 禁用菜单栏
  mainWindow.setMenuBarVisibility(false);
  isDev() && mainWindow.webContents.openDevTools();

  loadSource(
    mainWindow,
    isDev() ? process.env.VITE_SERVER_PORT! : process.env.EXPRESS_SERVER_PORT!
  );

  return registerWindowEvents(mainWindow);
}

function createWindow(params: { width?: number; height?: number }) {
  const { width, height } = params || {};
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize();
  const { width: maxWidth, height: maxHeight } = CONSTANTS.APP.DEFAULT_WINDOW_SIZE;
  const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(0.65);

  return WindowManager.createBrowserWindow(
    {
      width: width || Math.min(effectiveWidth, maxWidth),
      height: height || Math.min(effectiveHeight, maxHeight),
      title: CONSTANTS.APP.MAIN_WINDOW_TITLE,
      titleBarStyle: "hidden",
      webPreferences: {
        preload: preloadPath,
        scrollBounce: false,
        experimentalFeatures: true,
        webgl: true,
        webSecurity: false
      },
      frame: false,
      show: false,
      minHeight: Math.floor(Math.min(minHeight, maxHeight * 0.65)),
      minWidth: Math.floor(Math.min(minWidth, maxWidth * 0.65))
    },
    CONSTANTS.APP.MAIN_WINDOW_ID
  );
}

function loadSource(mainWindow: BrowserWindow, port: number | string) {
  mainWindow.loadURL(`http://localhost:${port}`).catch((err) => {
    Log.error(
      new EqError({
        label: "app/window/main.ts",
        message: `failed to load main window URL http://localhost:${process.env.VITE_SERVER_PORT}`,
        raw: err
      })
    );
  });
  return mainWindow;
}

function registerWindowEvents(mainWindow: BrowserWindow) {
  mainWindow.on("resized", () => {
    Store.set("window", mainWindow.getBounds());
  });

  mainWindow.on("moved", () => {
    Store.set("window", mainWindow.getBounds());
  });

  mainWindow.webContents.setWindowOpenHandler((e) => {
    Log.info(`Blocked attempt to open external link: ${e.url}`);
    // TODO: 可以考虑用 shell.openExternal 打开外部浏览器
    return { action: "deny" };
  });

  return mainWindow;
}
