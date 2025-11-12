import { getEffectiveWindowSize } from "../../utils/screen";
import { WindowManager } from "../manager";
import { CONSTANTS } from "../../constant";
import { isDev } from "../../utils/dev";
import { exitAppWithError } from "./exit";
import { EqError } from "../../utils/err";
import { appPathJoin } from "../../utils/path";
import { BrowserWindow } from "electron";

export function initMainWindow() {
  const mainWindow = createInitWindow();
  loadPageSource(mainWindow);
  return mainWindow;
}

function createInitWindow() {
  const { effectiveWidth, effectiveHeight } = getEffectiveWindowSize();

  return WindowManager.createBrowserWindow(
    {
      title: CONSTANTS.APP.MAIN_WINDOW_TITLE,
      width: effectiveWidth,
      height: effectiveHeight,
      autoHideMenuBar: true,
      frame: false,
      show: false,
      center: true
    },
    CONSTANTS.APP.MAIN_WINDOW_TITLE
  );
}

function loadPageSource(mainWindow: BrowserWindow) {
  if (isDev()) {
    mainWindow
      .loadURL("http://localhost:5173")
      .then(() => {
        mainWindow.show();
      })
      .catch((err) =>
        exitAppWithError(
          new EqError({
            message: "Failed to load main window URL",
            label: "app/main.ts:initMainWindow",
            raw: err
          })
        )
      );
  } else {
    mainWindow
      .loadFile(appPathJoin("dist-ui", "index.html"))
      .then(() => {
        mainWindow.show();
      })
      .catch((err) =>
        exitAppWithError(
          new EqError({
            raw: err,
            message: "Failed to load main window file",
            label: "app/main.ts:initMainWindow"
          })
        )
      );
  }
}
