import { app } from "electron";
import { initMainWindow } from "./window";
import { exitAppGracefully } from "./window/app";

app.on("ready", () => {
  const mainWindow = initMainWindow();
  mainWindow.webContents.openDevTools();
  mainWindow.on("closed", exitAppGracefully);
});
