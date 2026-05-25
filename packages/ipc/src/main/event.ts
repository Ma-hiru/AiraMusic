import { ipcMain, type IpcMainEvent } from "electron";
import type { NormalEvent, NormalEventPayload } from "@/types/event";

export function registerEventHandlers(handlerMap: {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
}) {
  for (const [event, handler] of Object.entries(handlerMap)) {
    ipcMain.on(event, handler);
  }
}
