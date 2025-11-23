type InvokeEventMaps = {
  message: [message: string, string];
  readFile: [filePath: string, Promise<{ ok: boolean; data?: ArrayBuffer }>];
  GPUInfo: [never, Promise<string>];
};

type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "minimizeToTray";
  isMaximized: boolean;
  createLoginWindow: never;
  createLyricWindow: never;
  createMiniplayerWindow: never;
  sendMessageTo: {
    to: WindowType;
    from: WindowType;
    data: string;
    type:
      | "login"
      | "lyricSync"
      | "lyricInit"
      | "lyricClose"
      | "lyricVersionChange"
      | "closeMiniplayer"
      | "nextTrack"
      | "lastTrack"
      | "playTrack";
  };
  close: WindowType;
  minimize: WindowType;
  maximize: WindowType;
  unmaximize: WindowType;
  hidden: WindowType;
  visible: WindowType;
};

type NormalEventRegister = {
  sendMessageToHandler: (handler: (message: NormalEventMaps["sendMessageTo"]) => void) => void;
};

type NormalEvent = keyof NormalEventMaps;

type InvokeEvent = keyof InvokeEventMaps;
