import { registerEventHandlers, registerInvokeHandlers } from "../ipc/main";
import { app } from "electron";

export function registerIpcMain() {
  app.on("ready", () => {
    registerInvokeHandlers();
    registerEventHandlers();
  });
}
