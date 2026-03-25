import { app } from "electron";
import { APP } from ".";
import { Log } from "../utils/log";
import { isCreateTray } from "../utils/platform";
import { CreateMainWindow, registerTray, WindowManager } from "../window";

export function registerAppEvents(instance: APP) {
  app.on("ready", () => {
    Log.debug("App ready");
    CreateMainWindow();
    handleExternalWindowEvents(instance);
    if (isCreateTray) {
      registerTray();
    }
  });
}

function handleExternalWindowEvents(instance: APP) {
  const mainWindow = WindowManager.get("main");
  if (!mainWindow) return;
  mainWindow.on("closed", instance.exit.bind(instance));
}
