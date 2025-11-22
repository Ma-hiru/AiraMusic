type InvokeEventMaps = {
  message: [message: string, string];
  readFile: [filePath: string, Promise<{ ok: boolean; data?: ArrayBuffer }>];
  GPUInfo: [never, Promise<string>];
};

type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "minimizeToTray";
  isMaximized: boolean;
  createLoginWindow: never;
  sendMessageTo: { to: WindowType; from: WindowType; data: string; type: "login" };
  close: WindowType;
  minimize: WindowType;
  maximize: WindowType;
  unmaximize: WindowType;
};

type NormalEventRegister = {
  sendMessageToHandler: (handler: (message: NormalEventMaps["sendMessageTo"]) => void) => void;
};

type NormalEvent = keyof NormalEventMaps;

type InvokeEvent = keyof InvokeEventMaps;
