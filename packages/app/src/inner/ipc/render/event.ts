import { ipcRenderer } from "electron";

export const rendererEventAPI = {
  resizeInternalWindow: (payload) => ipcRenderer.send("resizeInternalWindow", payload),
  moveInternalWindow: (payload) => ipcRenderer.send("moveInternalWindow", payload),
  openExternalLink: (payload) => ipcRenderer.send("openExternalLink", payload),
  openInternalWindow: (payload) => ipcRenderer.send("openInternalWindow", payload),
  openInternalDevTools: (payload) => ipcRenderer.send("openInternalDevTools", payload),
  closeInternalWindow: (payload) => ipcRenderer.send("closeInternalWindow", payload),
  focusInternalWindow: (payload) => ipcRenderer.send("focusInternalWindow", payload),
  hiddenInternalWindow: (payload) => ipcRenderer.send("hiddenInternalWindow", payload),
  showInternalWindow: (payload) => ipcRenderer.send("showInternalWindow", payload),
  minimizeInternalWindow: (payload) => ipcRenderer.send("minimizeInternalWindow", payload),
  unminimizeInternalWindow: (payload) => ipcRenderer.send("unminimizeInternalWindow", payload),
  maximizeInternalWindow: (payload) => ipcRenderer.send("maximizeInternalWindow", payload),
  unmaximizeInternalWindow: (payload) => ipcRenderer.send("unmaximizeInternalWindow", payload),
  mousePenetrateInternalWindow: (payload) =>
    ipcRenderer.send("mousePenetrateInternalWindow", payload),
  fatalError: (payload) => ipcRenderer.send("fatalError", payload)
} satisfies RendererEventAPI;
