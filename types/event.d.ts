/**
 * 基本事件类型定义
 * Normal 事件：单向通知事件，无返回值
 * Invoke 事件：双向调用事件，有返回值
 * */

/** Invoke 事件类型以及参数 */
type InvokeEventMaps = {
  GPUInfo: [never, Promise<unknown>];
  platform: [never, NodeJS.Platform];
  isMaximized: [WindowType, boolean];
  hasOpenInternalWindow: [WindowType, boolean];
  storeKey: [never, string];
  checkOnlineStatus: [never, Promise<NetworkStatus>];
  currentWindowType: [never, WindowType];
  currentWindowBounds: [
    never,
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
  runtimeID: [never, string];
};

/** Normal 事件类型以及参数 */
type NormalEventMaps = {
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
  mousePenetrateInternalWindow: { type: Optional<WindowType>; penetrate: boolean };
  fatalError: { message: string; error?: string };
};

/**
 * 事件的衍生类型定义
 * 包括事件名称、事件参数、事件负载
 * */

/** Invoke 事件类型 */
type InvokeEvent = keyof InvokeEventMaps;
/** Normal 事件类型 */
type NormalEvent = keyof NormalEventMaps;
/** Normal 事件负载类型 */
type NormalEventPayload<T extends NormalEvent> = NormalEventMaps[T];
/** Invoke 事件参数类型 */
type InvokeEventArgs<T extends InvokeEvent> = InvokeEventMaps[T][0];
/** Invoke 事件负载类型 */
type InvokeEventPayload<T extends InvokeEvent> = InvokeEventMaps[T][1];

/**
 * Renderer 侧事件API定义
 * 事件生效应该在 Renderer 和 Main 两侧都进行注册
 * */

/** renderer 侧 Normal 事件注册API（可以主动发起Normal事件） */
type RendererEventAPI = {
  [K in NormalEvent]: RendererNormalEventHandler<K>;
};
type RendererNormalEventHandler<T extends NormalEvent> =
  NormalEventPayload<T> extends never ? () => void : (param: NormalEventPayload<T>) => void;
/** renderer 侧 Invoke 事件注册API（可以主动发起Invoke事件） */
type RendererInvokeAPI = {
  [K in InvokeEvent]: RendererInvokeEventHandler<K>;
};
type RendererInvokeEventHandler<T extends InvokeEvent> =
  InvokeEventArgs<T> extends never
    ? () => Promise<InvokeEventPayload<T>>
    : (param: InvokeEventArgs<T>) => Promise<InvokeEventPayload<T>>;
