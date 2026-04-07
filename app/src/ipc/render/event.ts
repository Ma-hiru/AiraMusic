import AppTypedRendererIPC from "./typed";

export const rendererEventAPI = {
  message: (payload) => AppTypedRendererIPC.send("message", payload),
  resizeInternalWindow: (payload) => AppTypedRendererIPC.send("resizeInternalWindow", payload),
  moveInternalWindow: (payload) => AppTypedRendererIPC.send("moveInternalWindow", payload),
  openExternalLink: (payload) => AppTypedRendererIPC.send("openExternalLink", payload),
  openInternalWindow: (payload) => AppTypedRendererIPC.send("openInternalWindow", payload),
  openInternalDevTools: (payload) => AppTypedRendererIPC.send("openInternalDevTools", payload),
  closeInternalWindow: (payload) => AppTypedRendererIPC.send("closeInternalWindow", payload),
  focusInternalWindow: (payload) => AppTypedRendererIPC.send("focusInternalWindow", payload),
  hiddenInternalWindow: (payload) => AppTypedRendererIPC.send("hiddenInternalWindow", payload),
  showInternalWindow: (payload) => AppTypedRendererIPC.send("showInternalWindow", payload),
  minimizeInternalWindow: (payload) => AppTypedRendererIPC.send("minimizeInternalWindow", payload),
  unminimizeInternalWindow: (payload) =>
    AppTypedRendererIPC.send("unminimizeInternalWindow", payload),
  maximizeInternalWindow: (payload) => AppTypedRendererIPC.send("maximizeInternalWindow", payload),
  unmaximizeInternalWindow: (payload) =>
    AppTypedRendererIPC.send("unmaximizeInternalWindow", payload),
  mousePenetrateInternalWindow: (payload) =>
    AppTypedRendererIPC.send("mousePenetrateInternalWindow", payload),
  fatalError: (payload) => AppTypedRendererIPC.send("fatalError", payload)
} satisfies RendererEventAPI;
