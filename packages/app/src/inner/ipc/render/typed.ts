import { ipcRenderer, IpcRendererEvent } from "electron";

export class AppTypedRendererIPC {
  static on<T extends keyof RendererEventListenerAPI>(
    event: T,
    handler: NormalFunc<
      [IpcRendererEvent, Parameters<Parameters<RendererEventListenerAPI[T]>[0]>[0]]
    >
  ) {
    ipcRenderer.on(event, handler);
  }

  static send<T extends NormalEvent>(
    event: T,
    value: NormalEventPayload<T> extends never ? undefined : NormalEventPayload<T>
  ) {
    ipcRenderer.send(event, value);
  }

  static async invoke<T extends InvokeEvent>(
    event: T,
    value?: InvokeEventArgs<T>
  ): Promise<InvokeEventPayload<T>> {
    return await ipcRenderer.invoke(event, value);
  }
}
