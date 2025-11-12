import { app } from "electron";
import { initMainWindow } from "./window";

app.on("ready", () => {
  const mainWindow = initMainWindow();
  mainWindow.center();
});
