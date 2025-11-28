import { typedIpcRenderInvoke } from "./typed";

export const renderInvokeAPI: RenderInvokeAPI = {
  message: (msg) => typedIpcRenderInvoke("message", msg),
  readFile: (local) => typedIpcRenderInvoke("readFile", local),
  GPUInfo: () => typedIpcRenderInvoke("GPUInfo", undefined),
  isMaximized: (winType) => typedIpcRenderInvoke("isMaximized", winType),
  platform: () => typedIpcRenderInvoke("platform", undefined)
};
