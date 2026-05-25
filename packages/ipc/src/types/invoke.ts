/** Invoke 事件类型以及参数 */
export type InvokeEventMaps = {
  GPUInfo: [undefined, Promise<unknown>];
  platform: [undefined, NodeJS.Platform];
  isMaximized: [WindowType, boolean];
  hasOpenInternalWindow: [WindowType, boolean];
  storeKey: [undefined, string];
  checkOnlineStatus: [undefined, Promise<NetworkStatus>];
  currentWindowType: [undefined, WindowType];
  currentWindowBounds: [
    undefined,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      workAreaHeight: number;
      workAreaWidth: number;
    }
  ];
  selectPath: [type: "dir" | "file", Promise<{ ok: boolean; path: string; error?: string }>];
  saveFile: [{ buffer: ArrayBuffer; name: string }, Promise<{ ok: boolean; error?: string }>];
  isFullscreen: [WindowType, boolean];
  runtimeID: [undefined, string];
};

/** Invoke 事件类型 */
export type InvokeEvent = keyof InvokeEventMaps;

/** Invoke 事件参数类型 */
export type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

/** Invoke 事件负载类型 */
export type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];
