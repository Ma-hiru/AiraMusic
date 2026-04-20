import AppTypedRendererIPC from "./typed";

export const rendererInvokeAPI = {
  selectPath: (data) => AppTypedRendererIPC.invoke("selectPath", data),
  saveFile: (data) => AppTypedRendererIPC.invoke("saveFile", data),
  GPUInfo: () => AppTypedRendererIPC.invoke("GPUInfo"),
  isMaximized: (type) => AppTypedRendererIPC.invoke("isMaximized", type),
  platform: () => AppTypedRendererIPC.invoke("platform"),
  hasOpenInternalWindow: (win) => AppTypedRendererIPC.invoke("hasOpenInternalWindow", win),
  isFullscreen: (type) => AppTypedRendererIPC.invoke("isFullscreen", type),
  storeKey: () => AppTypedRendererIPC.invoke("storeKey"),
  checkOnlineStatus: () => AppTypedRendererIPC.invoke("checkOnlineStatus"),
  currentWindowType: () => AppTypedRendererIPC.invoke("currentWindowType"),
  currentWindowBounds: () => AppTypedRendererIPC.invoke("currentWindowBounds"),
  runtimeID: () => AppTypedRendererIPC.invoke("runtimeID")
} satisfies RendererInvokeAPI;
