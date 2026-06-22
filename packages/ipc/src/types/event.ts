/** Normal 事件类型以及参数 */
export type NormalEventMaps = {
  event_window_resize: {
    type: Optional<WindowType>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  event_window_move: {
    type: Optional<WindowType>;
    x?: number;
    y?: number;
    deltaX?: number;
    deltaY?: number;
  };
  event_window_external: { url: string; title: string };
  event_window_browser: { url: string };
  event_window_open: WindowType;
  event_window_debug: Optional<WindowType>;
  event_window_close: Optional<WindowType>;
  event_window_focus: Optional<WindowType>;
  event_window_hidden: Optional<WindowType>;
  event_window_show: Optional<WindowType>;
  event_window_minimize: Optional<WindowType>;
  event_window_unminimize: Optional<WindowType>;
  event_window_maximize: Optional<WindowType>;
  event_window_unmaximize: Optional<WindowType>;
  event_window_pin: {
    type: Optional<WindowType>;
    pin: boolean;
    level?:
      | "normal"
      | "floating"
      | "torn-off-menu"
      | "modal-panel"
      | "main-menu"
      | "status"
      | "pop-up-menu"
      | "screen-saver"
      | "dock";
  };
  event_window_penetrate: { type: Optional<WindowType>; penetrate: boolean };
  event_debug_fatal: { message: string; error?: string };
  event_debug_log: { level: "trace" | "debug" | "info" | "warn" | "error"; message: string };
};

/** Normal 事件类型 */
export type NormalEvent = keyof NormalEventMaps;

/** Normal 事件负载类型 */
export type NormalEventArgs<T extends NormalEvent> = NormalEventMaps[T];
