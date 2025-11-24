import { registerInvokeHandlers } from "./invoke";
import { registerEventHandlers } from "./event";
import ElectronStore from "electron-store";
import { BrowserWindow } from "electron";
import { StoreType } from "../../app/store";

export { typedIpcMainOn, typedIpcMainSend, typedIpcMainHandle } from "./typed";

export function registerIpcMainHandlers(
  mainWindow: BrowserWindow,
  store: ElectronStore<StoreType>
) {
  registerInvokeHandlers(mainWindow, store);
  registerEventHandlers(mainWindow, store);
}
