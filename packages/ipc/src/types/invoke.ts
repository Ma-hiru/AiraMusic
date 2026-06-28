/** Invoke 事件类型以及参数 */
export type InvokeEventMaps = {
  invoke_device_net: [undefined, Promise<NetworkStatus>];
  invoke_device_gpu: [undefined, Promise<unknown>];
  invoke_device_platform: [undefined, NodeJS.Platform];
  invoke_window_id: [undefined, WindowType];
  invoke_window_maximized: [WindowType, boolean];
  invoke_window_opened: [WindowType, boolean];
  invoke_window_pinned: [WindowType, boolean];
  invoke_window_fullscreen: [WindowType, boolean];
  invoke_window_bounds: [
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
  invoke_runtime_token: [undefined, string];
  invoke_runtime_id: [undefined, string];
  invoke_fs_select: [
    type: "dir" | "file",
    Promise<{ ok: boolean; path: string; error?: string; canceled?: boolean }>
  ];
  invoke_fs_save: [
    { buffer: ArrayBuffer; name: string },
    Promise<{ ok: boolean; error?: string; canceled?: boolean }>
  ];
  invoke_store_get: [string, { ok: true; value: JsonValue } | { ok: false; reason?: string }];
  invoke_store_set: [
    { key: string; value: JsonValue },
    { ok: true } | { ok: false; reason?: string }
  ];
  invoke_store_delete: [string, { ok: false; reason?: string } | { ok: true }];
  invoke_cache_config_get: [undefined, { ttl: string; path: string; capacity: number }];
  invoke_cache_config_update: [
    { ttl?: string; path?: string; capacity?: number },
    (
      | { ok: true; config: { ttl: string; path: string; capacity: number } }
      | { ok: false; reason: string }
    )
  ];
};

/** Invoke 事件类型 */
export type InvokeEvent = keyof InvokeEventMaps;

/** Invoke 事件参数类型 */
export type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];

/** Invoke 事件负载类型 */
export type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];
