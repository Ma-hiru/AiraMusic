import { ipcRenderer } from "electron";

export const renderInvokeAPI: RenderInvokeAPI = {
  message: (msg) => ipcRenderer.invoke("message", msg)
};
