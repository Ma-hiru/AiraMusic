import { typedIpcMainHandle, typedIpcMainOn } from "./typed";
import { BrowserWindow } from "electron";
import ElectronStore from "electron-store";
import { StoreType } from "../background";

export function registerIpcMainHandlers(window: BrowserWindow, store: ElectronStore<StoreType>) {
  typedIpcMainHandle("message", (e, data) => {
    console.log("Message invoke received in main:", data);
    return `Received: ${data}`;
  });
}
