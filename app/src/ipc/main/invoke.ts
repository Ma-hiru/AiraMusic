import { BrowserWindow } from "electron";
import ElectronStore from "electron-store";
import { StoreType } from "../../app";
import { typedIpcMainHandle } from "./typed";

export function registerInvokeHandlers(mainWindow: BrowserWindow, store: ElectronStore<StoreType>) {
  typedIpcMainHandle("message", (e, data) => {
    console.log("Message invoke received in main:", data);
    return `Received: ${data}`;
  });
}
