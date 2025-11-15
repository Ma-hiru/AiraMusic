import { app } from "electron";
import { initMainWindow } from "./window";
import { exitAppGracefully } from "./window/app";
import { registerIpcMainHandlers } from "./ipc/main";
import { typedIpcMainSend } from "./ipc/typed";

app.on("ready", () => {
  const mainWindow = initMainWindow();
  registerIpcMainHandlers();
  mainWindow.on("show", () => {
    typedIpcMainSend(mainWindow, "log", 114514);
  });
  mainWindow.on("closed", exitAppGracefully);
});
