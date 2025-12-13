/**
 * 基本事件类型定义
 * Normal 事件：单向通知事件，无返回值
 * Invoke 事件：双向调用事件，有返回值
 * */

/** Invoke 事件类型以及参数 */
type InvokeEventMaps = {
  readFile: [filePath: string, Promise<{ ok: boolean; data?: ArrayBuffer }>];
  GPUInfo: [undefined, Promise<unknown>];
  platform: [undefined, NodeJS.Platform];
  isMaximized: [undefined, boolean];
  hasOpenInternalWindow: [WindowType, boolean];
};

/** Normal 事件类型以及参数 */
type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "ask" | "tray";
  message: MessageDataSend<any>;
  /** window control */
  close: undefined | { broadcast?: boolean };
  minimize: never;
  unminimize: never;
  maximize: never;
  unmaximize: never;
  hidden: never;
  visible: never;
  loaded: { broadcast: boolean; hide?: boolean };
  mousePenetrate: boolean;
  resizeWindow: Partial<{ x: number; y: number; width: number; height: number }>;
  openDevTools: never;
  openExternalLink: { url: string; title: string };
  openInternalWindow: WindowType;
  closeInternalWindow: WindowType;
};

/** Normal 事件的 Message 类型以及其参数 */
type MessageTypeMap = {
  /** token */
  login: string;
  lyricSync: LyricSync;
  lyricSyncReverse: LyricSyncReverse;
  lyricInit: LyricInit;
  lyricVersion: LyricVersionType;
  infoSync: InfoSync;
  nextTrack: undefined;
  lastTrack: undefined;
  playTrack: undefined;
  otherWindowLoaded: undefined;
  otherWindowClosed: undefined;
};

/** Normal 事件的 Message 类型的发送参数 */
type MessageDataSend<T extends keyof MessageTypeMap> = {
  to: WindowType;
  data: MessageTypeMap[T];
  type: T;
};

/** Normal 事件的 Message 类型的接收参数 */
type MessageDataReceive<T extends keyof MessageTypeMap> = {
  from: WindowType;
  data: MessageTypeMap[T];
  type: T;
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
/** renderer 侧 Normal 事件监听API（注册监听Normal事件的监听器） */
type RendererEventListenerAPI = {
  message: (handler: (message: MessageDataReceive<any>) => void) => void;
};
