import { registerInvokeHandlers } from "./invoke";
import { registerEventHandlers } from "./event";
import { app } from "electron";

export function registerIpcMain() {
  app.on("ready", () => {
    registerInvokeHandlers();
    registerEventHandlers();
  });
}
