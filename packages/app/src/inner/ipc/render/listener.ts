import { AppTypedRendererIPC } from "./typed";

export const rendererEventListenerAPI = {
  message: (handler) => {
    AppTypedRendererIPC.on("message", (_e, data) => {
      handler(data);
    });
  }
} satisfies RendererEventListenerAPI;
