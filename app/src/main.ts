import { app } from "electron";
import { isDev } from "./utils/dev";
import { appPathJoin } from "./utils/path";
import { CONSTANTS } from "./constant";
import { WindowManager } from "./window";
import { EqError } from "./utils/err";

function initMainWindow() {
  const [width, height] = CONSTANTS.APP.INIT_WINDOW_SIZE;
  const mainWindow = WindowManager.createBrowserWindow(
    {
      title: CONSTANTS.APP.INIT_WINDOW_TITLE,
      width,
      height,
      autoHideMenuBar: true,
      frame: false
    },
    "main"
  );
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5173").catch((err: Error) => {
      EqError.printDEV("app/main.ts:initMainWindow", "Failed to load main window in dev mode", err);
    });
  } else {
    mainWindow.loadFile(appPathJoin("dist-ui", "index.html")).catch((err: Error) => {
      EqError.printDEV(
        "app/main.ts:initMainWindow",
        "Failed to load main window in prod mode",
        err
      );
    });
  }

  return mainWindow;
}

app.on("ready", () => {
  const mainWindow = initMainWindow();
  mainWindow.center();
});
