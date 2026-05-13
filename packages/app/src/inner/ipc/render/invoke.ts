import { ipcRenderer } from "electron";

export const rendererInvokeAPI = {
  selectPath: (data) => ipcRenderer.invoke("selectPath", data),
  saveFile: (data) => ipcRenderer.invoke("saveFile", data),
  GPUInfo: () => ipcRenderer.invoke("GPUInfo"),
  isMaximized: (type) => ipcRenderer.invoke("isMaximized", type),
  platform: () => ipcRenderer.invoke("platform"),
  hasOpenInternalWindow: (win) => ipcRenderer.invoke("hasOpenInternalWindow", win),
  isFullscreen: (type) => ipcRenderer.invoke("isFullscreen", type),
  storeKey: () => ipcRenderer.invoke("storeKey"),
  checkOnlineStatus: () => ipcRenderer.invoke("checkOnlineStatus"),
  currentWindowType: () => ipcRenderer.invoke("currentWindowType"),
  currentWindowBounds: () => ipcRenderer.invoke("currentWindowBounds"),
  runtimeID: () => ipcRenderer.invoke("runtimeID")
} satisfies RendererInvokeAPI;
