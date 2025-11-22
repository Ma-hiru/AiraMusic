import { BrowserWindow } from "electron";
import { Log } from "../utils/log";
import { checkPositionOutScreenBounds, getEffectiveWindowSize } from "../utils/screen";
import { preloadPath } from "../utils/path";
import { CONSTANTS } from "../constant";
import { WindowManager } from "../window";
import { isDev } from "../utils/dev";
import { EqError } from "../utils/err";

export function createInitWindow(params: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}) {
  Log.trace("Create APP Window");
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

  return loadSource(mainWindow);
}

function createWindow(params: { width?: number; height?: number }) {
  const { width, height } = params || {};
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize();
  const { width: maxWidth, height: maxHeight } = CONSTANTS.APP.DEFAULT_WINDOW_SIZE;
  const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(0.65);

  Log.trace(
    "app/createWindow.ts",
    "store size:",
    width,
    height,
    "effective size:",
    effectiveWidth,
    effectiveHeight,
    "max size:",
    maxWidth,
    maxHeight,
    "min size:",
    minWidth,
    minHeight
  );
  console.error(
    "width",
    width || Math.min(effectiveWidth, maxWidth),
    "height",
    height || Math.min(effectiveHeight, maxHeight),
    "minHeight",
    Math.min(minHeight, maxHeight * 0.65),
    "minWidth",
    Math.min(minWidth, maxWidth * 0.65)
  );
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

function loadSource(mainWindow: BrowserWindow) {
  if (isDev()) {
    mainWindow.webContents.openDevTools();
    mainWindow.loadURL("http://localhost:5173").catch((err) => {
      Log.error(
        new EqError({
          label: "app/createWindow.ts",
          message: "Failed to load URL http://localhost:5173",
          raw: err
        })
      );
    });
  } else {
    mainWindow.loadURL("http://localhost:27232").catch((err) => {
      Log.error(
        new EqError({
          label: "app/createWindow.ts",
          message: "Failed to load URL http://localhost:27232",
          raw: err
        })
      );
    });
  }

  return mainWindow;
}
