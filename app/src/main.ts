import { app } from "electron";
import { initMainWindow } from "./window";
import { exitAppGracefully } from "./window/app";

app.on("ready", () => {
  const mainWindow = initMainWindow();
  mainWindow.on("closed", exitAppGracefully);
});
