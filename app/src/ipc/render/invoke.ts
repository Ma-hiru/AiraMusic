import { typedIpcRenderInvoke } from "./typed";

export const rendererInvokeAPI = {
  readFile: (path) => typedIpcRenderInvoke("readFile", path),
  writeFile: (data) => typedIpcRenderInvoke("writeFile", data),
  selectPath: (data) => typedIpcRenderInvoke("selectPath", data),
  GPUInfo: () => typedIpcRenderInvoke("GPUInfo"),
  isMaximized: () => typedIpcRenderInvoke("isMaximized"),
  platform: () => typedIpcRenderInvoke("platform"),
  hasOpenInternalWindow: (win) => typedIpcRenderInvoke("hasOpenInternalWindow", win),
  storeKey: () => typedIpcRenderInvoke("storeKey"),
  checkOnlineStatus: () => typedIpcRenderInvoke("checkOnlineStatus"),
  isMainWindow: () => typedIpcRenderInvoke("isMainWindow")
} satisfies RendererInvokeAPI;
