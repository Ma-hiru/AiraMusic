import { BrowserWindow, ipcMain, IpcMainEvent, IpcMainInvokeEvent } from "electron";

export const typedIpcMainOn = <T extends NormalEvent>(
  event: T,
  handler: NormalFunc<[IpcMainEvent, NormalEventPayload<T>]>
) => {
  ipcMain.on(event, handler);
};

export const typedIpcMainHandle = <T extends InvokeEvent>(
  event: T,
  handler: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<T>], InvokeEventPayload<T>>
) => {
  ipcMain.handle(event, handler);
};

export const typedIpcMainSend = <T extends NormalEvent>(
  window: BrowserWindow,
  event: T,
  value: NormalEventPayload<T>
) => {
  window.webContents.send(event, value);
};
