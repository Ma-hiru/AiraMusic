import { app } from "electron";
import { EqError } from "../../utils/err";
import { WindowManager } from "../manager";

export function exitAppWithError(err: any) {
  WindowManager.closeAllBrowserWindows();
  EqError.printDEV("app/main.ts:exitAppWithError", "Critical error occurred, exiting app", err);
  //TODO: Show error dialog to user
  releaseAppResources();
}

export function exitAppGracefully() {
  releaseAppResources();
}

function releaseAppResources() {
  app.quit();
}
