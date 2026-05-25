import { ipcMain, type IpcMainInvokeEvent } from "electron";
import type { InvokeEvent, InvokeEventPayload, InvokeEventArgs } from "@/types/invoke";

export function registerInvokeHandlers(handlerMap: {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
}) {
  for (const [event, handler] of Object.entries(handlerMap)) {
    ipcMain.handle(event, (event, ...args) => handler(event, args[0] as never));
  }
}
