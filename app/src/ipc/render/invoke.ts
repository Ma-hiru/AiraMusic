import AppTypedRendererIPC from "./typed";

export const rendererInvokeAPI = {
  readFile: (path) => AppTypedRendererIPC.invoke("readFile", path),
  writeFile: (data) => AppTypedRendererIPC.invoke("writeFile", data),
  selectPath: (data) => AppTypedRendererIPC.invoke("selectPath", data),
  GPUInfo: () => AppTypedRendererIPC.invoke("GPUInfo"),
  isMaximized: (type) => AppTypedRendererIPC.invoke("isMaximized", type),
  platform: () => AppTypedRendererIPC.invoke("platform"),
  hasOpenInternalWindow: (win) => AppTypedRendererIPC.invoke("hasOpenInternalWindow", win),
  storeKey: () => AppTypedRendererIPC.invoke("storeKey"),
  checkOnlineStatus: () => AppTypedRendererIPC.invoke("checkOnlineStatus"),
  currentWindowType: () => AppTypedRendererIPC.invoke("currentWindowType")
} satisfies RendererInvokeAPI;
