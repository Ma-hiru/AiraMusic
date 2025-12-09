import { typedIpcRenderOn } from "./typed";

export const rendererEventListenerAPI = {
  message: (handler) => {
    typedIpcRenderOn("message", (_e, data) => {
      handler(data);
    });
  }
} satisfies RendererEventListenerAPI;
