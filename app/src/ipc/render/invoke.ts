import { typedIpcRenderInvoke } from "./typed";

export const rendererInvokeAPI = {
  readFile: (path) => typedIpcRenderInvoke("readFile", path),
  GPUInfo: () => typedIpcRenderInvoke("GPUInfo", undefined),
  isMaximized: () => typedIpcRenderInvoke("isMaximized", undefined),
  platform: () => typedIpcRenderInvoke("platform", undefined),
  hasOpenInternalWindow: (win) => typedIpcRenderInvoke("hasOpenInternalWindow", win)
} satisfies RendererInvokeAPI;
