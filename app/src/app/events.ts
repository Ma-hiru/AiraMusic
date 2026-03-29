import { app } from "electron";
import { APP } from ".";
import { Log } from "../utils/log";
import { isCreateTray } from "../utils/platform";
import { MainWindow, registerTray } from "../window";

export function registerAppEvents(instance: APP) {
  app.on("ready", () => {
    Log.debug("App ready");
    const mainWindow = MainWindow.create();
    mainWindow.on("closed", instance.exit.bind(instance));
    isCreateTray && registerTray();
  });
}
