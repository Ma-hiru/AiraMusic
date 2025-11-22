import { typedIpcRenderSend } from "./typed";

export const renderEventAPI: RenderEventAPI = {
  isMaximized: () => {},
  rememberCloseAppOption: () => {},
  createLoginWindow: () => typedIpcRenderSend("createLoginWindow", undefined),
  createLyricWindow: () => typedIpcRenderSend("createLyricWindow", undefined),
  close: (winType) => typedIpcRenderSend("close", winType),
  minimize: (winType) => typedIpcRenderSend("minimize", winType),
  maximize: (winType) => typedIpcRenderSend("maximize", winType),
  unmaximize: (winType) => typedIpcRenderSend("unmaximize", winType),
  sendMessageTo: ({ to, data, type, from }) =>
    typedIpcRenderSend("sendMessageTo", { to, data, type, from })
};
