import { ipcRenderer } from "electron";

export const renderInvokeAPI: Record<InvokeEvent, RenderInvokeEventHandler<InvokeEvent>> = {
  message: (msg: string) => ipcRenderer.invoke("message", msg)
};

export const renderEventAPI: Record<NormalEvent, RenderNormalEventHandler<NormalEvent>> = {
  isMaximized: (_e) => {},
  rememberCloseAppOption: (_opts) => {}
};

export function setupRenderEventListeners() {
  ipcRenderer.on("log", (e, data) => {
    console.log("Log event received in renderer:", data);
  });
}
