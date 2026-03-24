/**
 * 基本事件类型定义
 * Normal 事件：单向通知事件，无返回值
 * Invoke 事件：双向调用事件，有返回值
 * */

/** Invoke 事件类型以及参数 */
type InvokeEventMaps = {
  readFile: [filePath: string, Promise<{ ok: boolean; data?: ArrayBuffer }>];
  writeFile: [{ buffer: ArrayBuffer; name: string }, Promise<{ error?: string; ok: boolean }>];
  GPUInfo: [never, Promise<unknown>];
  platform: [never, NodeJS.Platform];
  isMaximized: [WindowType, boolean];
  hasOpenInternalWindow: [WindowType, boolean];
  storeKey: [never, string];
  checkOnlineStatus: [never, Promise<NetworkStatus>];
  currentWindowType: [never, WindowType];
  selectPath: [type: "dir" | "file", Promise<{ ok: boolean; path: string; error?: string }>];
};

/** Normal 事件类型以及参数 */
type NormalEventMaps = {
  message: MessageDataSend<any>;
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
};

/** Normal 事件的 Message 类型以及其参数 */
type MessageTypeMap = {
  login: string;
  infoBus: {
    backgroundCover: Undefinable<string>;
    theme: {
      mainColor: string;
      secondaryColor: string;
      textColor: string;
    };
  };
  playerBus: {
    track: Optional<{
      id: number;
      name: string;
      sourceID: number;
      sourceName: "playlist" | "album" | "other";
      track: NeteaseTrackModel;
    }>;
    lyric: Optional<FullVersionLyricLine>;
    lyricVersion: Optional<LyricVersionType>;
    repeat: "off" | "one" | "all";
    shuffle: boolean;
    status: "playing" | "paused" | "error" | "idle" | "loading";
  };
  progressBus: {
    currentTime: number;
    duration: number;
    volume: number;
    buffered: number;
  };
  playerActionBus: "next" | "previous" | "play" | "pause" | "exit";
  commentBus: {
    id: number;
    type: unknown;
  };
  windowBus: {
    type: WindowType;
    action:
      | "ready"
      | "close"
      | "focus"
      | "hide"
      | "show"
      | "maximize"
      | "unmaximize"
      | "minimize"
      | "unminimize";
  };
  imageCheckerBus: {
    url: string;
    alt?: string;
  };
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
