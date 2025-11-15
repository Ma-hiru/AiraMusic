import { app } from "electron";
import { EqError } from "../../utils/err";
import { WindowManager } from "../manager";
import { Log } from "../../utils/log";

export function exitAppWithError(err: any) {
  WindowManager.closeAllBrowserWindows();
  Log.error(
    new EqError({
      label: "app/main.ts:exitAppWithError",
      message: "Critical error occurred, exiting app",
      raw: err
    })
  );
  //TODO: Show error dialog to user
  releaseAppResources();
}

export function exitAppGracefully() {
  releaseAppResources();
}

function releaseAppResources() {
  app.quit();
}
