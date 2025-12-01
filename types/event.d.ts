type InvokeEventMaps = {
  message: [message: string, string];
  readFile: [filePath: string, Promise<{ ok: boolean; data?: ArrayBuffer }>];
  GPUInfo: [never, Promise<string>];
  platform: [never, NodeJS.Platform];
  isMaximized: [win: WindowType, boolean];
};

type SendMessageDataType<T = any> = {
  to: WindowType;
  from: WindowType;
  data: T;
  type:
    | "login"
    | "lyricSync"
    | "lyricInit"
    | "lyricClose"
    | "lyricVersionChange"
    | "closeMiniplayer"
    | "nextTrack"
    | "lastTrack"
    | "playTrack"
    | "windowMaximizedChange"
    | "winLoaded";
};

type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "minimizeToTray";
  createLoginWindow: never;
  createLyricWindow: never;
  createMiniplayerWindow: never;
  sendMessageTo: SendMessageDataType;
  close: WindowType;
  minimize: WindowType;
  maximize: WindowType;
  unmaximize: WindowType;
  hidden: WindowType;
  visible: WindowType;
  mousePenetrate: { win: WindowType; penetrate: boolean };
  resizeWindow: {
    win: WindowType;
    bounds: Partial<{ x: number; y: number; width: number; height: number }>;
  };
  loaded: { win: WindowType; broadcast: boolean; showAfterLoaded: boolean };
};

type NormalEventRegister = {
  sendMessageToHandler: (handler: (message: NormalEventMaps["sendMessageTo"]) => void) => void;
};

type NormalEvent = keyof NormalEventMaps;

type InvokeEvent = keyof InvokeEventMaps;
