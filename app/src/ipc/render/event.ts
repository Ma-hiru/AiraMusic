import { typedIpcRenderSend } from "./typed";

export const rendererEventAPI = {
  rememberCloseAppOption: (payload) => typedIpcRenderSend("rememberCloseAppOption", payload),
  message: (payload) => typedIpcRenderSend("message", payload),
  /** window control */
  openExternalLink: (payload) => typedIpcRenderSend("openExternalLink", payload),
  openInternalWindow: (payload) => typedIpcRenderSend("openInternalWindow", payload),
  closeInternalWindow: (payload) => typedIpcRenderSend("closeInternalWindow", payload),
  focusInternalWindow: (payload) => typedIpcRenderSend("focusInternalWindow", payload),
  openDevTools: () => typedIpcRenderSend("openDevTools", undefined),
  close: (props) => typedIpcRenderSend("close", props),
  minimize: () => typedIpcRenderSend("minimize", undefined),
  unminimize: () => typedIpcRenderSend("unminimize", undefined),
  maximize: () => typedIpcRenderSend("maximize", undefined),
  unmaximize: () => typedIpcRenderSend("unmaximize", undefined),
  hidden: () => typedIpcRenderSend("hidden", undefined),
  visible: () => typedIpcRenderSend("visible", undefined),
  resizeWindow: (payload) => typedIpcRenderSend("resizeWindow", payload),
  moveWindow: (payload) => typedIpcRenderSend("moveWindow", payload),
  mousePenetrate: (payload) => typedIpcRenderSend("mousePenetrate", payload),
  loaded: (payload) => typedIpcRenderSend("loaded", payload)
} satisfies RendererEventAPI;
