import { typedIpcRenderOn } from "./typed";

export const renderEventRegister: NormalEventRegister = {
  sendMessageToHandler: (handler) => {
    typedIpcRenderOn("sendMessageTo", (_e, data) => {
      handler(data);
    });
  }
};
