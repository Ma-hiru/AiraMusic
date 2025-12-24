import { ipcRenderer, IpcRendererEvent } from "electron";

export const typedIpcRenderOn = <T extends keyof RendererEventListenerAPI>(
  event: T,
  handler: NormalFunc<[IpcRendererEvent, Parameters<Parameters<RendererEventListenerAPI[T]>[0]>[0]]>
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
  value?: InvokeEventArgs<T>
): Promise<InvokeEventPayload<T>> => {
  return await ipcRenderer.invoke(event, value);
};
