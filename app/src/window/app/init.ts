import { getEffectiveWindowSize } from "../../utils/screen";
import { WindowManager } from "../manager";
import { CONSTANTS } from "../../constant";
import { isDev } from "../../utils/dev";
import { exitAppWithError } from "./exit";
import { EqError } from "../../utils/err";
import { appPathJoin } from "../../utils/path";

export function initMainWindow() {
  const { width, height } = getEffectiveWindowSize();
  const mainWindow = WindowManager.createBrowserWindow(
    {
      title: CONSTANTS.APP.INIT_WINDOW_TITLE,
      width,
      height,
      autoHideMenuBar: true,
      frame: false,
      show: false,
      center: true
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
