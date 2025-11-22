import { typedIpcRenderInvoke } from "./typed";

export const renderInvokeAPI: RenderInvokeAPI = {
  message: (msg) => typedIpcRenderInvoke("message", msg),
  readFile: (local) => typedIpcRenderInvoke("readFile", local),
  GPUInfo: () => typedIpcRenderInvoke("GPUInfo", undefined)
};
