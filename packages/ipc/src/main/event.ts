import { ipcMain, type IpcMainEvent } from "electron";
import type { NormalEvent, NormalEventPayload } from "../types/event";

const registered = new Map<string, NormalFunc<[IpcMainEvent, any]>>();

export function registerEventHandlers(handlerMap: {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
}) {
  for (const [event, handler] of Object.entries(handlerMap)) {
    ipcMain.on(event, handler);
    registered.set(event, handler);
  }
}

export function unregisterEventHandlers() {
  for (const [event, handler] of [...registered]) {
    ipcMain.off(event, handler);
    registered.delete(event);
  }
}
