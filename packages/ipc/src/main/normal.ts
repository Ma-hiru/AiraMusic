import { ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from "electron";

import type { NormalEvent, NormalEventArgs } from "../types/event";
import type { InvokeEvent, InvokeEventArgs, InvokeEventPayload } from "../types/invoke";

export class NormalChannel {
  private static readonly registeredEventHandlers = new Map<
    string,
    NormalFunc<[IpcMainEvent, any]>
  >();
  private static readonly registeredInvokeHandlers = new Map();

  static registerEventHandlers(handlerMap: {
    [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventArgs<K>]>;
  }) {
    for (const [event, handler] of Object.entries(handlerMap)) {
      ipcMain.on(event, handler);
      NormalChannel.registeredEventHandlers.set(event, handler);
    }
  }

  static registerInvokeHandlers(handlerMap: {
    [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
  }) {
    for (const [event, handler] of Object.entries(handlerMap)) {
      ipcMain.handle(event, (event, ...args) => handler(event, args[0] as never));
      NormalChannel.registeredInvokeHandlers.set(event, handler);
    }
  }

  static [Symbol.dispose]() {
    for (const [event, handler] of [...NormalChannel.registeredEventHandlers]) {
      ipcMain.off(event, handler);
      NormalChannel.registeredEventHandlers.delete(event);
    }
    for (const [event] of [...NormalChannel.registeredInvokeHandlers]) {
      ipcMain.removeHandler(event);
      NormalChannel.registeredInvokeHandlers.delete(event);
    }
  }
}

export type EventHandlers = Parameters<typeof NormalChannel.registerEventHandlers>[0];

export type InvokeHandlers = Parameters<typeof NormalChannel.registerInvokeHandlers>[0];
