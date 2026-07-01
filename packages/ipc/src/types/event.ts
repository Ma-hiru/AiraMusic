/** Normal 事件类型以及参数 */
export type NormalEventMaps = {
  event_window_open: WindowType;
  event_window_browser: { url: string };
  event_window_show: Optional<WindowType>;
  event_window_close: Optional<WindowType>;
  event_window_debug: Optional<WindowType>;
  event_window_focus: Optional<WindowType>;
  event_window_hidden: Optional<WindowType>;
  event_window_maximize: Optional<WindowType>;
  event_window_minimize: Optional<WindowType>;
  event_window_unmaximize: Optional<WindowType>;
  event_window_unminimize: Optional<WindowType>;
  event_window_external: { url: string; title: string };
  event_debug_fatal: { error?: string; message: string };
  event_window_title: { title: string; type: WindowType };
  event_window_penetrate: { penetrate: boolean; type: Optional<WindowType> };
  event_debug_log: { message: string; level: "info" | "warn" | "debug" | "error" | "trace" };
  event_window_move: {
    x?: number;
    y?: number;
    deltaX?: number;
    deltaY?: number;
    type: Optional<WindowType>;
  };
  event_window_resize: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    type: Optional<WindowType>;
  };
  event_window_pin: {
    pin: boolean;
    type: Optional<WindowType>;
    level?:
      | "dock"
      | "normal"
      | "status"
      | "floating"
      | "main-menu"
      | "modal-panel"
      | "pop-up-menu"
      | "screen-saver"
      | "torn-off-menu";
  };
};

/** Normal 事件类型 */
export type NormalEvent = keyof NormalEventMaps;

/** Normal 事件负载类型 */
export type NormalEventArgs<T extends NormalEvent> = NormalEventMaps[T];
