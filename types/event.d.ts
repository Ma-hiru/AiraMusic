type InvokeEventMaps = {
  message: [message: string, string];
};

type NormalEventMaps = {
  rememberCloseAppOption: "exit" | "minimizeToTray";
  isMaximized: boolean;
  createLoginWindow: never;
  loggedInSuccess: string; // cookies
  close: WindowType;
  minimize: WindowType;
  maximize: WindowType;
  unmaximize: WindowType;
};

type NormalEvent = keyof NormalEventMaps;

type InvokeEvent = keyof InvokeEventMaps;
