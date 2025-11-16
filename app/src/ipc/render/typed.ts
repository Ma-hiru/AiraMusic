import { ipcRenderer, IpcRendererEvent } from "electron";

export const typedIpcRenderOn = <T extends NormalEvent>(
  event: T,
  handler: NormalFunc<[IpcRendererEvent, NormalEventPayload<T>]>
) => {
  ipcRenderer.on(event, handler);
};

export const typedIpcRenderSend = <T extends NormalEvent>(
  event: T,
  value: NormalEventPayload<T> extends never ? undefined : NormalEventPayload<T>
) => {
  ipcRenderer.send(event, value);
};

export const typedIpcRenderInvoke = async <T extends InvokeEvent>(
  event: T,
  value: InvokeEventArgs<T> extends never ? undefined : InvokeEventArgs<T>
): Promise<InvokeEventPayload<T>> => {
  return await ipcRenderer.invoke(event, value);
};
