import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { InvokeEvent, InvokeEventArgs, InvokeEventPayload } from "../types/invoke";

const registered = new Map();

export function registerInvokeHandlers(handlerMap: {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
}) {
  for (const [event, handler] of Object.entries(handlerMap)) {
    ipcMain.handle(event, (event, ...args) => handler(event, args[0] as never));
    registered.set(event, handler);
  }
}

export function unregisterInvokeHandlers() {
  for (const [event] of [...registered]) {
    ipcMain.removeHandler(event);
    registered.delete(event);
  }
}
