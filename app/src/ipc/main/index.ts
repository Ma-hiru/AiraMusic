import { registerInvokeHandlers } from "./invoke";
import { registerEventHandlers } from "./event";
import { BrowserWindow } from "electron";

export { typedIpcMainOn, typedIpcMainSend, typedIpcMainHandle } from "./typed";

export function registerIpcMainHandlers(mainWindow: BrowserWindow) {
  registerInvokeHandlers();
  registerEventHandlers(mainWindow);
}
