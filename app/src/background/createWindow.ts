import { BrowserWindowConstructorOptions, screen } from "electron";
import { Log } from "../utils/log";
import { getEffectiveWindowSize } from "../utils/screen";
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

  const { width, height, x, y } = params || {};
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize();
  const { effectiveWidth: minWidth, effectiveHeight: minHeight } = getEffectiveWindowSize(0.5);

  const options: BrowserWindowConstructorOptions = {
    width: width || effectiveWidth,
    height: height || effectiveHeight,
    title: CONSTANTS.APP.MAIN_WINDOW_TITLE,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: preloadPath
    },
    frame: false,
    show: false,
    minHeight,
    minWidth
  };
  if (x && y) {
    const displays = screen.getAllDisplays();
    let isResetWindow = false;
    if (displays.length === 1) {
      const { bounds } = displays[0]!;
      if (
        x < bounds.x ||
        x > bounds.x + bounds.width - 50 ||
        y < bounds.y ||
        y > bounds.y + bounds.height - 50
      ) {
        isResetWindow = true;
      } else {
        isResetWindow = true;
        for (const display of displays) {
          const { bounds } = display;
          if (
            x > bounds.x &&
            x < bounds.x + bounds.width &&
            y > bounds.y &&
            y < bounds.y + bounds.height
          ) {
            isResetWindow = false;
            break;
          }
        }
      }
    }
    if (!isResetWindow) {
      options.x = x;
      options.y = y;
    }
  }
  const mainWindow = WindowManager.createBrowserWindow(options, CONSTANTS.APP.MAIN_WINDOW_ID);
  mainWindow.setMenuBarVisibility(false);

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
