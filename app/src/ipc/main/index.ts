import { registerInvokeHandlers } from "./invoke";
import { registerEventHandlers } from "./event";
import ElectronStore from "electron-store";
import { StoreType } from "../../background";
import { BrowserWindow } from "electron";

export { typedIpcMainOn, typedIpcMainSend, typedIpcMainHandle } from "./typed";

export function registerIpcMainHandlers(
  mainWindow: BrowserWindow,
  store: ElectronStore<StoreType>
) {
  registerInvokeHandlers(mainWindow, store);
  registerEventHandlers(mainWindow, store);
}
