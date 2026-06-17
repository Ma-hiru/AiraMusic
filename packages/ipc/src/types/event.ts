/** Normal 事件类型以及参数 */
export type NormalEventMaps = {
  resizeInternalWindow: {
    type: Optional<WindowType>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  moveInternalWindow: {
    type: Optional<WindowType>;
    x?: number;
    y?: number;
    deltaX?: number;
    deltaY?: number;
  };
  openExternalLink: { url: string; title: string };
  openInternalWindow: WindowType;
  openInternalDevTools: Optional<WindowType>;
  closeInternalWindow: Optional<WindowType>;
  focusInternalWindow: Optional<WindowType>;
  hiddenInternalWindow: Optional<WindowType>;
  showInternalWindow: Optional<WindowType>;
  minimizeInternalWindow: Optional<WindowType>;
  unminimizeInternalWindow: Optional<WindowType>;
  maximizeInternalWindow: Optional<WindowType>;
  unmaximizeInternalWindow: Optional<WindowType>;
  pinInternalWindow: {
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
  mousePenetrateInternalWindow: { type: Optional<WindowType>; penetrate: boolean };
  fatalError: { message: string; error?: string };
  log: { level: "trace" | "debug" | "info" | "warn" | "error"; message: string };
};

/** Normal 事件类型 */
export type NormalEvent = keyof NormalEventMaps;

/** Normal 事件负载类型 */
export type NormalEventPayload<T extends NormalEvent> = NormalEventMaps[T];
