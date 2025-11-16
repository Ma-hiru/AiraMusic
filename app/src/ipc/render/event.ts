import { typedIpcRenderSend } from "./typed";

export const renderEventAPI: RenderEventAPI = {
  isMaximized: (_e) => {},
  rememberCloseAppOption: (_opts) => {},
  createLoginWindow: () => typedIpcRenderSend("createLoginWindow", undefined),
  loggedInSuccess: (cookie) => typedIpcRenderSend("loggedInSuccess", cookie),
  close: (winType) => typedIpcRenderSend("close", winType),
  minimize: (winType) => typedIpcRenderSend("minimize", winType),
  maximize: (winType) => typedIpcRenderSend("maximize", winType),
  unmaximize: (winType) => typedIpcRenderSend("unmaximize", winType)
};
