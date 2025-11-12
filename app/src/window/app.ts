import { app } from "electron";
import { WindowManager } from "./manager";
import { CONSTANTS } from "../constant";
import { EqError } from "../utils/err";
import { isDev } from "../utils/dev";
import { appPathJoin } from "../utils/path";

export function exitAppWithError(err: any) {
  WindowManager.closeAllBrowserWindows();
  EqError.printDEV("app/main.ts:exitAppWithError", "Critical error occurred, exiting app", err);
  //TODO: Show error dialog to user
  app.quit();
}

export function initMainWindow() {
  const [width, height] = CONSTANTS.APP.INIT_WINDOW_SIZE;
  const mainWindow = WindowManager.createBrowserWindow(
    {
      title: CONSTANTS.APP.INIT_WINDOW_TITLE,
      width,
      height,
      autoHideMenuBar: true,
      frame: false,
      show: false
    },
    "main"
  );

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

  return mainWindow;
}
