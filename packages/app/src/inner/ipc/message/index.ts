import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";

export type MainEventAPI = {
  [K in NormalEvent]: NormalFunc<[IpcMainEvent, NormalEventPayload<K>]>;
};

export type MainInvokeAPI = {
  [K in InvokeEvent]: NormalFunc<[IpcMainInvokeEvent, InvokeEventArgs<K>], InvokeEventPayload<K>>;
};
